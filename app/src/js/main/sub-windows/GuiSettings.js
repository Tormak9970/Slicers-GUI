import { getSetting, updateSettings } from "../../../api/config/settings/Settings.js";
import { resourcePath } from "../../../api/config/resource-path/ResourcePath.js";

const fs = require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");
const changeEvent = new Event('change');

let settingsJSON = getSetting();

//DOM elements

// General settings
const langDrop = document.getElementById("langDrop");

//Accessibility settings
const alertNotif = document.getElementById('alertNotif');

//Sound Settings
const ambientMusicEnabled = document.getElementById('ambientMusicEnabled');
const ambientMusicSelectContainer = document.getElementById('ambientMusicSelectContainer');
const ambientMusicSelect = document.getElementById('ambientMusicSelect');
const audioDisCont = document.getElementById('audioDisCont');
const playWhenMin = document.getElementById('playWhenMin');

const customMusicCont = document.getElementById('customMusicCont');
const musicPathInput = document.getElementById('musicPathInput');
const musicFolderUpload = document.getElementById('musicFolderUpload');
const musicFileUpload = document.getElementById('musicFileUpload');

//change btns
const saveAll = document.getElementById('saveAll');
const cancelAll = document.getElementById('cancelAll');

//cancel modal
const cancelModalBackground = document.getElementById('cancelModalBackground');
const confirmCancel = document.getElementById('confirmCancel');
const cancelCancel = document.getElementById('cancelCancel');

const configPath = path.normalize(path.join(resourcePath, "config.json"));
const cache = {
    "lang": "",
    "alerts": "",
    "useLabelTooltips": "",
    "usePathTooltips": "",
    "ambientMusic": {
        "enabled": "",
        "selected": "",
        "path": "",
        "playMinimized": ""
    }
};
let changedFields = [];

async function loadCache() {
    let res = fs.readFileSync(configPath);
    let jsonObj = await JSON.parse(res);
    cache["lang"] = jsonObj["extraction"]["lang"];

    cache.alerts = settingsJSON.alerts;
    cache.ambientMusic = settingsJSON.ambientMusic;

    //set lang setting
    langDrop.options[0].innerHTML = cache.lang;
    console.log(cache);

    langDrop.nextElementSibling.innerHTML = langDrop.options[0].innerHTML;
    langDrop.nextElementSibling.nextElementSibling.querySelector('.same-as-selected').classList.toggle('same-as-selected');
    langDrop.nextElementSibling.nextElementSibling.querySelector(`#${langDrop.options[0].innerHTML}`).classList.toggle('same-as-selected');

    //set allert settings
    alertNotif.options[0].innerHTML = cache.alerts;
    alertNotif.nextElementSibling.innerHTML = alertNotif.options[0].innerHTML;
    alertNotif.nextElementSibling.nextElementSibling.querySelector('.same-as-selected').classList.toggle('same-as-selected');
    alertNotif.nextElementSibling.nextElementSibling.querySelector(`#${alertNotif.options[0].innerHTML}`).classList.toggle('same-as-selected');

    //set audio settings
    ambientMusicEnabled.checked = cache.ambientMusic.enabled;
    if (ambientMusicEnabled.checked) {
        ambientMusicSelectContainer.style.display = '';
        audioDisCont.style.display = '';
    } else {
        ambientMusicSelectContainer.style.display = 'none';
        audioDisCont.style.display = 'none';
    }

    ambientMusicSelect.options[0].innerHTML = cache.ambientMusic.selected;
    ambientMusicSelect.nextElementSibling.innerHTML = ambientMusicSelect.options[0].innerHTML;
    ambientMusicSelect.nextElementSibling.nextElementSibling.querySelector('.same-as-selected').classList.toggle('same-as-selected');
    ambientMusicSelect.nextElementSibling.nextElementSibling.querySelector(`#${ambientMusicSelect.options[0].innerHTML}`).classList.toggle('same-as-selected');
    
    if (cache.ambientMusic.selected == "Custom") {
        musicPathInput.value = cache.ambientMusic.path;
        customMusicCont.style.display = '';
    }
    playWhenMin.checked = cache['ambientMusic']['playMinimized'];
}
function updateCache(field, value, parent=null) {
    if (field == "lang") {
        let res = fs.readFileSync(configPath);
        let json = JSON.parse(res);
        json["extraction"][field] = value;
        cache[field] = value;

        fs.writeFileSync(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
        if (!changedFields.includes(field)) changedFields.push(field);
    } else {
        if (field == "selected") {
            if (value == "Custom") {
                customMusicCont.style.display = '';
            } else if (cache['ambientMusic']['selected'] == "Custom") {
                customMusicCont.style.display = 'none';
            }
        }
        if (parent) {
            const data = [parent, field];
            cache[parent][field] = value;
            if (changedFields.filter(e => e.toString() === data.toString()).length == 1) {
                changedFields.splice(changedFields.indexOf(data), 1);
            } else {
                changedFields.push(data);
            }
        } else {
            cache[field] = value;
            if (field == "alerts") {
                if (!changedFields.includes(field)) changedFields.push(field);
            } else {
                if (changedFields.includes(field)) changedFields.splice(changedFields.indexOf(field), 1); else changedFields.push(field);
            }
        }
    }
    if (changedFields.length > 0) {
        saveAll.classList.remove('disabled');
        cancelAll.classList.remove('disabled');
    } else {
        saveAll.classList.add('disabled');
        cancelAll.classList.add('disabled');
    }
}

function init() {
    loadCache();
    initSubs();
    initListeners();
}
function initListeners() {
    //change buttons
    saveAll.addEventListener('click', async (e) => { 
        await updateSettings(cache); 

        ipcRenderer.send('settingsSaved', [changedFields, cache]); 
        changedFields = []; 
        
        saveAll.classList.add('disabled'); 
        cancelAll.classList.add('disabled'); 
        saveAll.blur();
    });
    cancelAll.addEventListener('click', (e) => { cancelModalBackground.style.display = ''; });

    //language
    langDrop.clickCallback = (e) => { updateCache("lang", e.currentTarget.innerHTML); }

    //alerts
    alertNotif.clickCallback = (e) => { updateCache('alerts', e.currentTarget.innerHTML); }

    //Sound Settings
    ambientMusicEnabled.addEventListener('click', (e) => {
        updateCache('enabled', ambientMusicEnabled.checked, 'ambientMusic');
        if (ambientMusicEnabled.checked) {
            ambientMusicSelectContainer.style.display = '';
            audioDisCont.style.display = '';
        } else {
            ambientMusicSelectContainer.style.display = 'none';
            audioDisCont.style.display = 'none';
        }
    });
    ambientMusicSelect.clickCallback = (e) => { updateCache('selected', e.currentTarget.innerHTML, 'ambientMusic'); }
    playWhenMin.addEventListener('click', (e) => { updateCache('playMinimized', playWhenMin.checked, 'ambientMusic'); });

    musicPathInput.addEventListener('change', (e) => {
        if (fs.existsSync(e.currentTarget.value)) {
            updateCache('path', e.currentTarget.value, 'ambientMusic');
        } else {
            e.currentTarget.value = cache['ambientMusic']['path'];
        }
    });
    musicFileUpload.addEventListener('click', (e) => { ipcRenderer.send('openMusicFileDialog'); });
    musicFolderUpload.addEventListener('click', (e) => { ipcRenderer.send('openMusicFolderDialog'); });


    //cancel modal
    confirmCancel.addEventListener('click', (e) => {
        ipcRenderer.send('settingsCanceled');
        
        cancelModalBackground.style.display = 'none';

        saveAll.classList.add('disabled');
        cancelAll.classList.add('disabled');
        cancelAll.blur();
    });
    cancelCancel.addEventListener('click', (e) => { cancelModalBackground.style.display = 'none'; });
}
function initSubs() {
    ipcRenderer.on('musicFileResponse', (event, data) => {
        const path = data[0];
        if (path != '') {
            musicPathInput.value = path;
            musicPathInput.dispatchEvent(changeEvent);
        }
    });
    ipcRenderer.on('musicFolderResponse', (event, data) => {
        const path = data[0];
        if (path != '') {
            musicPathInput.value = path;
            musicPathInput.dispatchEvent(changeEvent);
        }
    });
}


init();