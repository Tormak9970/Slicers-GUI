import { addStyleIfNotExists } from "../../../js/Util.js";
const chngEvn = new Event('change');

class CheckBox extends HTMLInputElement {
    constructor() {
        super();

        addStyleIfNotExists('../api/components/check-box/CheckBox.css');

        this.type = 'checkbox';
        
        const parent = this.parentElement;

        const container = document.createElement('div');
        container.className = 'check-box-container';

        parent.replaceChild(container, this);
        container.appendChild(this);

        const span = document.createElement('span');
        span.className = 'check-box';
        container.append(span);

        span.addEventListener('click', (e) => {
            this.checked = !this.checked;
            if (this.checked) {
                this.setAttribute('checked', '');
            } else {
                this.removeAttribute('checked');
            }
            this.dispatchEvent(chngEvn);
        });
    }
}

customElements.define('check-box', CheckBox, { extends: 'input' });