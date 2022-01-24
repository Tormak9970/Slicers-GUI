import { RenderDom } from "../../classes/RenderDom.js";
import { sourcePath, resourcePath } from "../../../api/config/resource-path/ResourcePath.js";

globalThis.DOM = RenderDom;

const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

//DOM Variables
const hashTypeCont = document.getElementById('hashTypeCont');
const spinner = document.getElementById('spinner');
const generate = document.getElementById('generate');

const progressBar__clientGOM = document.getElementById('progressBar__clientGOM');
const progressBar__baseNodes = document.getElementById('progressBar__baseNodes');
const progressBar__protoNodes = document.getElementById('progressBar__protoNodes');
const progressBar__assets = document.getElementById('progressBar__assets');

const actualFound = document.getElementById('actualFound');
const namesFound = document.getElementById('namesFound');
const numSearched = document.getElementById('numSearched');
//buttons
const genHashes = document.getElementById('genHashes');
const cancelGen = document.getElementById('cancelHashGen');

//Consts
const hashTypes = [ "All", "AMX", "BNK", "CNV", "DAT", "DYN", "EPP", "FXSPEC", "GR2", "HYD", "ICONS", "MAT", "MISC", "MISC_WORLD", "PLC", "PRT", "SDEF", "STB", "XML" ];
const configPath = path.normalize(path.join(resourcePath, "config.json"));
const cache = {
    "checked": {}
}

let hashWorker;

async function init() {
    await loadCache();

    for (const hType of hashTypes) {
        const typeCont = genEntr(hType, cache["checked"][hType]);
        hashTypeCont.appendChild(typeCont);
    }

    const warningDiv = document.createElement('div');
    warningDiv.className = "warn-desc";
    warningDiv.innerHTML = "** = gonna take a while"

    hashTypeCont.appendChild(warningDiv);

    initListeners();
    initSubs();
    initHashWorker();
    
    if (!globalThis.DOM.hasLoaded && !globalThis.DOM.isLoading) {
        globalThis.DOM.initWorkers(resourcePath, sourcePath);
    }
}

// Caching functions
async function loadCache() {
    let res = fs.readFileSync(configPath);
    let jsonObj = await JSON.parse(res);
    let json = jsonObj["hashGenerator"];

    cache["checked"] = json["checked"];
}
function updateCache(field, val, sec) {
    if (sec) {
        let res = fs.readFileSync(configPath);
        let json = JSON.parse(res);
        json["hashGenerator"][field][sec] = val;
        cache[field][sec] = val;

        fs.writeFileSync(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
    }
}

function initHashWorker() {
    hashWorker = new Worker(path.join(sourcePath, "js", "extraction", "gen-hash", "HashWorker.js"), {
        type: "module"
    });

    hashWorker.onerror = (e) => { console.log(e); throw new Error(`${e.message} on line ${e.lineno}`); }
    hashWorker.onmessageerror = (e) => { console.log(e); throw new Error(`${e.message} on line ${e.lineno}`); }
    hashWorker.onmessage = (e) => {
        switch (e.data.message) {
            case "complete":
                const names = e.data.data.names;
                console.log(names);
                genHashes.classList.toggle('disabled');
                break;
            case "progress":
                actualFound.innerHTML = e.data.data.totalActualFound;
                namesFound.innerHTML = e.data.data.totalNamesFound;
                numSearched.innerHTML = e.data.data.totalFilesSearched;
                break;
        }
    }

    hashWorker.postMessage({
        "message": "init",
        "data": resourcePath
    });
}

function initListeners() {
    const chkbxs = document.querySelectorAll('input');
    const allChk = document.getElementById('AllChk');

    for (const box of chkbxs) {
        if (box.id !== "AllChk") {
            box.addEventListener('change', (e) => {
                const elem = e.currentTarget;
                updateCache("checked", elem.checked, elem.name);

                if (!elem.checked && allChk.checked) {
                    updateCache("checked", false, "All");
                    allChk.checked = false;
                }

                if (getChecked().length == 0) {
                    genHashes.classList.add('disabled');
                } else {
                    genHashes.classList.remove('disabled');
                }
            });
        } else {
            allChk.addEventListener('change', (e) => {
                const elem = e.currentTarget;
                updateCache("checked", elem.checked, elem.name);

                for (const b of chkbxs) {
                    if (b.id !== "AllChk") {
                        b.checked = elem.checked;
                        updateCache("checked", b.checked, b.name);
                    }
                }

                if (getChecked().length == 0) {
                    genHashes.classList.add('disabled');
                } else {
                    genHashes.classList.remove('disabled');
                }
            });
        }
    }


    cancelGen.addEventListener('click', (e) => {
        ipcRenderer.send('cancelHashGen', '');
        document.querySelector('.header-container').innerHTML = 'Select file types to generate';
        genHashes.innerHTML = 'Load Data';

        hashTypeCont.classList.remove('hidden');
        spinner.classList.add('hidden');
        generate.classList.add('hidden');

        progressBar__baseNodes.style.width = '0%';
        progressBar__clientGOM.style.width = '0%';
        progressBar__protoNodes.style.width = '0%';
        progressBar__assets.style.width = '0%';

        namesFound.innerHTML = 0;
        numSearched.innerHTML = 0;
    });
    genHashes.addEventListener('click', (e) => {
        if (genHashes.innerHTML == 'Load Data') {
            hashTypeCont.classList.toggle('hidden');
            spinner.classList.toggle('hidden');
            document.querySelector('.header-container').innerHTML = 'Loading Data...';
            genHashes.classList.toggle('disabled');
        
            ipcRenderer.send('readAllDataPrep');
        } else if (genHashes.innerHTML == 'Generate') {
            hashWorker.postMessage({
                "message": 'genHash',
                "data": {
                    "checked": getChecked()
                }
            });

            genHashes.classList.toggle('disabled');
        } else {
            document.querySelector('.header-container').innerHTML = 'Select file types to generate';
            hashTypeCont.classList.toggle('hidden');
            genHashes.innerHTML = 'Load Data';

            ipcRenderer.send("hashComplete", [e.data.data.numActualFound, e.data.data.numFilesFound, e.data.data.numFilesSearched]);
        }
    });
}

function initSubs() {
    ipcRenderer.on('dataTorPaths', (event, data) => {
        const dat = fs.readFileSync(data[0]);
        const json = JSON.parse(dat);
        globalThis.DOM.hook({
            assetHooks: {
                assetsProgress: (progress) => {
                    progressBar__assets.style.width = progress;
                },
                assetsComplete: () => {
                    hashWorker.postMessage({
                        "message": "archivesComplete",
                        "data": globalThis.DOM.archives
                    });
                    if (progressBar__assets.style.width == '100%' &&
                        progressBar__baseNodes.style.width == '100%' &&
                        progressBar__clientGOM.style.width == '100%' &&
                        progressBar__protoNodes.style.width == '100%') {
    
                        document.querySelector('.header-container').innerHTML = 'Loading Complete!';
                        spinner.classList.toggle('hidden');
                        generate.classList.toggle('hidden');
                        genHashes.innerHTML = 'Generate';
                        genHashes.classList.toggle('disabled');
                    }
                }
            },
            gomHooks: {
                domUpdate: (progress) => {
                    hashWorker.postMessage({
                        "message": "setDOM",
                        "data": globalThis.DOM._dom
                    });
                    progressBar__clientGOM.style.width = progress;

                    if (progressBar__assets.style.width == '100%' &&
                        progressBar__baseNodes.style.width == '100%' &&
                        progressBar__clientGOM.style.width == '100%' &&
                        progressBar__protoNodes.style.width == '100%') {

                        document.querySelector('.header-container').innerHTML = 'Loading Complete!';
                        spinner.classList.toggle('hidden');
                        generate.classList.toggle('hidden');
                        genHashes.innerHTML = 'Generate';
                        genHashes.classList.toggle('disabled');
                    }
                },
                nodesUpdate: (progress, data) => {
                    hashWorker.postMessage({
                        "message": "nodesProgress",
                        "data": data
                    });
                    progressBar__baseNodes.style.width = progress;

                    if (progressBar__assets.style.width == '100%' &&
                        progressBar__baseNodes.style.width == '100%' &&
                        progressBar__clientGOM.style.width == '100%' &&
                        progressBar__protoNodes.style.width == '100%') {

                        document.querySelector('.header-container').innerHTML = 'Loading Complete!';
                        spinner.classList.toggle('hidden');
                        generate.classList.toggle('hidden');
                        genHashes.innerHTML = 'Generate';
                        genHashes.classList.toggle('disabled');
                    }
                },
                protosUpdate: (progress, data) => {
                    hashWorker.postMessage({
                        "message": "nodesProgress",
                        "data": data
                    });
                    progressBar__protoNodes.style.width = progress;

                    if (progressBar__assets.style.width == '100%' &&
                        progressBar__baseNodes.style.width == '100%' &&
                        progressBar__clientGOM.style.width == '100%' &&
                        progressBar__protoNodes.style.width == '100%') {

                        document.querySelector('.header-container').innerHTML = 'Loading Complete!';
                        spinner.classList.toggle('hidden');
                        generate.classList.toggle('hidden');
                        genHashes.innerHTML = 'Generate';
                        genHashes.classList.toggle('disabled');
                    }
                }
            }
        });
        if (!globalThis.DOM.hasLoaded && !globalThis.DOM.isLoading) {
            globalThis.DOM.load(json);
        } else {
            const fields = [ "archives", "_dom", "nodes", "protos" ];

            globalThis.DOM.getLoadStatus(fields, [ progressBar__assets, progressBar__clientGOM, progressBar__baseNodes, progressBar__protoNodes ]);

            if (globalThis.DOM.hasLoaded) {
                for (const field of fields) {
                    const handler = globalThis.DOM.invokeHandlerPost(field);
                    if (handler) handler();
                }
            }
        }
    });
}

//util funcs
function genEntr(hashType, isChecked) {
    const famCont = document.createElement('div');
    famCont.className = "hash-type";
    famCont.innerHTML = `<input name="${hashType}" id="${hashType}Chk" is="check-box" ${isChecked ? "checked" : ""}></input>`;

    const lbl = document.createElement('label');
    lbl.className = "hash-type-label";
    lbl.for = `${hashType}`;
    lbl.innerHTML = `${hashType}${hashType == "DAT" || hashType == "MISC_WORLD" || hashType == "CNV" ? "**" : ""}`;
    famCont.appendChild(lbl);

    return famCont
}
function getChecked() {
    const checked = [];
    const chkbxs = document.querySelectorAll('input');

    for (const box of chkbxs) {
        if (box.checked && box.name != 'All') {
            checked.push(box.name);
        }
    }

    return checked;
}

init();