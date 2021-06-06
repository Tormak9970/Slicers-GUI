export const updateTooltipEvent = new Event('updateTooltip');
export function addTooltip(orientation, element, multiCheck, callback, eventType='updateTooltip') {
    //callback function will return the value we want to display in the tooltip
    //callbacks must always take the element as a parameter
    
    const parent = element.parentNode;
    const tooltipContainer = document.createElement('div');
    tooltipContainer.className = "tooltip";
    const e = parent.replaceChild(tooltipContainer, element);

    if (multiCheck) {
        e.addEventListener(eventType, function() {
            this.nextElementSibling.innerText = callback(this);
        });
    }
    tooltipContainer.appendChild(e);

    const tooltipText = document.createElement('span');
    tooltipText.className = `tooltip-text tooltip-${orientation}`;
    tooltipText.innerText = callback(e);
    tooltipContainer.appendChild(tooltipText);
}