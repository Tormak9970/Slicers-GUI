import { fixDpi } from "../../Util.js";
import { NodeEntr } from "../../classes/formats/Node.js";

const FILETREE_HEIGHT = 16;
const NUM_META_FOLDERS = 2;

class NodesByFqn {
    constructor(json, deserializer) {
        if (json) {
            this.$O = json.$O;
            for (const kvp of Object.entries(json)) {
                if (kvp[0] != '_class' && kvp[0] != '$O') {
                    this[kvp[0]] = JSON.parse(kvp[1], deserializer);
                }
            }
        } else {
            this.$F = []; //files
            this.$O = 2;
            this._misc = {
                "$F": [], //files
                "$O": 0 //open
            }
        }
    }

    getObjectNoLoad(path) {
        const components = path.split('.');
        if (components.length > 1) {
            let parent = this;
            let idx = 0;
            for (const c of components) {
                if (idx == components.length - 1) {
                    return parent.$F[components[idx]];
                } else {
                    parent = parent[components[idx]];
                    idx++;
                }
            }
        } else {
            return this.$F[components[0]];
        }
    }
    getObject(path) {
        let ret = undefined;
        const components = path.split('.');
        if (components.length > 1) {
            let parent = this;
            let idx = 0;
            for (const c of components) {
                if (idx == components.length - 1) {
                    ret = parent.$F[components[idx]];
                } else {
                    parent = parent[components[idx]];
                    idx++;
                }
            }
        } else {
            ret = this.$F[components[0]];
        }

        if (ret) {
            ret.readNode();
        }

        return ret;
    }
    getObjectsStartingWith(fam) {
        let ret = [];
        let path = fam.split(".");
        path.pop();
        let parent = this;
        let seg;

        if (path.length > 1) {
            for (let i = 0; i < path.length - 1; i++) {
                parent = parent[path[i]];
            }

            seg = path[path.length - 1];
        } else {
            seg = path[0];
        }
        if (parent[seg]) {
            parent = parent[seg];
            recursiveAdd(fam, parent);
        }

        function recursiveAdd(fam, parent) {
            for (const kvp of Object.entries(parent)) {
                if (kvp[0] != '$O' && kvp[0] != '$F') {
                    recursiveAdd(`${fam}${kvp[0]}.`, kvp[1]);
                }
            }
            for (const entr of parent.$F) {
                ret.push(entr);
            }
        }

        return ret;
    }

    toJSON() {
        let ret = {
            "_class": 'NodesByFqn'
        };
        for (const kvp of Object.entries(this)) {
            if (typeof(kvp[1]) != 'function') {
                ret[kvp[0]] = kvp[1];
            }
        }
        return ret;
    }
}
let currentNode;

class ContextMenu {
    /**
     * @param  {NodeTree} nodeTree
     */
    constructor(nodeTree) {
        this.nodeTree = nodeTree;
        this.open = false;
        this.x = 0;
        this.y = 0;
        this.bounds = {
            x: 80,
            y: 40
        }

        this.clickedFolder = null;
    }

    pointInMenu(pos) { return (pos.x > this.x && pos.x < this.x+this.bounds.x) && (pos.y > this.y && pos.y < this.y+this.bounds.y); }

    render(ctx, pos) {
        const oldStroke = ctx.strokeStyle;
        const oldFill = ctx.fillStyle;
        const oldFont = ctx.font;

        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#292929";
        ctx.font = 'normal 10pt arial'; //'normal normal 200 10pt Eurofont';
        ctx.fillRect(this.x, this.y, this.bounds.x, this.bounds.y);
        ctx.strokeRect(this.x, this.y, this.bounds.x, this.bounds.y);

        ctx.fillStyle = "rgb(97, 97, 97)";
        if (pos.y < this.y+this.bounds.y / 2) {
            ctx.fillRect(this.x, this.y, this.bounds.x, this.bounds.y / 2);
        } else {
            ctx.fillRect(this.x, this.y + this.bounds.y / 2, this.bounds.x, this.bounds.y / 2);
        }

        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillText("Bulk Extract", this.x + this.bounds.x / 16, this.y + this.bounds.y / 8 + 10);
        ctx.fillText("Collapse All", this.x + this.bounds.x / 16, this.y + this.bounds.y - this.bounds.y / 8);

        ctx.strokeStyle = oldStroke;
        ctx.fillStyle = oldFill;
        ctx.font = oldFont;
    }

    #checkIfOpen(folder) {
        const dirs = Object.keys(folder).sort();
        for (let i = NUM_META_FOLDERS, l = dirs.length; i < l; i++) {
            const curDir = folder[dirs[i]];
            if (curDir.$O === 2) {
                this.#checkIfOpen(curDir);
                curDir.$O = 1;
            }
        }
    }

    collapseAll() { this.#checkIfOpen(this.nodeTree.nodesByFqn); }
}

class NodeTree {
    constructor(treeList, renderTarg, dataContainer, gomTree) {
        this.nodesByFqn = gomTree.nodesByFqn;
        this.parent = gomTree;
        this.renderTarg = renderTarg;
        this.dataContainer = dataContainer;
        this.menuInstance = new ContextMenu(this);

        this.hoverEle = -1;
        this.cursorPos = {x: -1, y: -1};

        this.scroller = document.getElementById('nav_nodes_scroller');
        this.scrollercon = document.getElementById('nav_nodes_scrollercon');
        this.scrollersize = document.getElementById('nav_nodes_scrollersize');
        this.scroller.onscroll = this.redraw;
        this.scroller.onmousemove = this.redraw;
        this.scroller.onmouseout = this.redraw;
        this.scrollercon.oncontextmenu = this.contextMenu;
        this.scrollercon.onmousedown = (e) => {
            if (e.button == 0) this.click(e);
        };
        this.canvas = treeList;
        this.ctx = this.canvas.getContext('2d', {
            alpha: false
        });
        fixDpi(this.canvas);
        this.resizeFull();
        this.redraw();
    }
    
    redraw = (e) => {
        this.ctx.translate(0.5, 0.5);
        this.canvas.width = this.scrollersize.offsetWidth * window.devicePixelRatio;
        this.canvas.style.width = `${this.scrollersize.offsetWidth}px`;
        this.canvas.height = this.scrollersize.offsetHeight * window.devicePixelRatio;
        this.canvas.style.height = `${this.scrollersize.offsetHeight}px`;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.ctx.font = 'normal 10pt arial'; //'normal normal 200 10pt Eurofont';
        this.ctx.fillStyle = "#333"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (e) {
            this.hoverEle = 15 - this.scroller.scrollTop + (e.offsetY & 0xFFFFF0);
            this.cursorPos = getMousePos(this.canvas, e);
            if (this.menuInstance.open && !this.menuInstance.pointInMenu(getMousePos(this.canvas, e))) {
                this.menuInstance.open = false;
                this.menuInstance.clickedFolder = null;
            }
        }
        if (this.parent.loadedBuckets === 0) {
            this.ctx.fillStyle = 'rgb(255, 255, 255)';
            this.ctx.fillText('Loading...', 170, 26)
        } else {
            this.drawFolder(this.nodesByFqn, 15 - this.scroller.scrollTop, FILETREE_HEIGHT - this.scroller.scrollLeft, this.scrollersize.offsetHeight)
        }
        if (this.menuInstance.open) {
            this.menuInstance.render(this.ctx, this.cursorPos);
        }
        this.ctx.translate(-0.5, -0.5);
    }
    
    drawFolder = (folder,heightIn,level,maxHeight) => {
        let height = heightIn;
        const dirs = Object.keys(folder).sort();
        const fl = folder.$F.length;
        for (let i = NUM_META_FOLDERS, l = dirs.length; i < l; i++) {
            if (height > 0 && height - FILETREE_HEIGHT < maxHeight) {
                if (height === this.hoverEle && !this.menuInstance.open) {
                    this.ctx.fillStyle = 'rgb(71, 71, 71)';
                    this.ctx.fillRect(level + 5, height - 12, 500, FILETREE_HEIGHT)
                }
                this.ctx.fillStyle = '#ffce00';
                if (i > NUM_META_FOLDERS || folder !== this.nodesByFqn) {
                    // This block adds the vertical dots
                    this.ctx.fillRect(3 + level - 11, height - 14, 1, 5);
                }
                // This block adds the horizontal dots
                this.ctx.fillRect(3 + level - 5, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 3, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 1, height - 4, 1, 1);

                // This block makes the squares
                this.ctx.fillRect(3 + level - 15, height - 8, 9, 1);
                this.ctx.fillRect(3 + level - 15, height, 9, 1);
                this.ctx.fillRect(3 + level - 15, height - 7, 1, 7);
                this.ctx.fillRect(3 + level - 7, height - 7, 1, 7);
                this.ctx.fillRect(3 + level - 13, height - 4, 5, 1);

                this.ctx.fillStyle = 'rgb(255, 255, 255)';
                this.ctx.fillText(dirs[i], 5 + level, height)
            }
            const curDir = folder[dirs[i]];
            if (curDir.$O === 2) {
                let prevHeight = height;
                height = this.drawFolder(curDir, height + FILETREE_HEIGHT, level + FILETREE_HEIGHT, maxHeight);
                if (i + 1 < l || fl > 0) {
                    let newHeight = height - 14;
                    if (prevHeight < 0)
                        prevHeight = 0;
                    if (newHeight > maxHeight)
                        newHeight = maxHeight;
                    this.ctx.fillStyle = '#ffce00';
                    for (let j = prevHeight+2; j < newHeight; j ++) {
                        // This adds the vertical dots to open folders
                        this.ctx.fillRect(3 + level - 11, j, 1, (j+1 < newHeight) ? 1 : 5)
                    }
                }
            } else {
                this.ctx.fillStyle = '#ffce00';
                // This makes the minus a plus
                this.ctx.fillRect(3 + level - 11, height - 6, 1, 5);
                height += FILETREE_HEIGHT
            }
        }
        for (let i = 0; i < fl; i++) {
            if (height > 0 && height - FILETREE_HEIGHT < maxHeight) {
                if (height === this.hoverEle && !this.menuInstance.open) {
                    this.ctx.fillStyle = 'rgb(71, 71, 71)';
                    this.ctx.fillRect(level, height - 12, 500, FILETREE_HEIGHT)
                }
                this.ctx.fillStyle = '#ffce00';
                if (i > 0) {
                    // This block adds missing vertical dots
                    this.ctx.fillRect(3 + level - 11, height - 19, 1, 5);
                }
                // This block adds vertical dots
                this.ctx.fillRect(3 + level - 11, height - 14, 1, 11);

                // This block adds horizontal dots
                this.ctx.fillRect(3 + level - 9, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 7, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 5, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 3, height - 4, 1, 1);
                this.ctx.fillRect(3 + level - 1, height - 4, 1, 1);
                const curFile = folder.$F[i];
                this.ctx.fillStyle = 'rgb(255, 255, 255)';
                this.ctx.fillText(curFile.fileName, 5 + level, height)
            }
            height += FILETREE_HEIGHT
        }
        return height
    }
    
    click = (e) => {
        if (this.menuInstance.open) {
            if (getMousePos(this.canvas, e).y < this.menuInstance.y+this.menuInstance.bounds.y / 2) {
                const tarNodeFam = this.getDirFqn(this.nodesByFqn, 15 - this.scroller.scrollTop, FILETREE_HEIGHT - this.scroller.scrollLeft, this.menuInstance.clickedFolder, "");

                if (tarNodeFam) {
                    this.parent.bulkCallback(tarNodeFam);
                }
            } else {
                this.menuInstance.collapseAll();
            }
            this.menuInstance.open = false;
            this.menuInstance.clickedFolder = null;

            this.resizeFull();
            this.redraw();
        } else {
            const clickEle = 15 - this.scroller.scrollTop + (e.offsetY & 0xFFFFF0);
            this.clickFolder(this.nodesByFqn, 15 - this.scroller.scrollTop, FILETREE_HEIGHT - this.scroller.scrollLeft, clickEle);
        }
    }

    contextMenu = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const pos = getMousePos(this.canvas, e);

        this.menuInstance.open = true;
        this.menuInstance.x = pos.x - 5;
        this.menuInstance.y = pos.y - 5;

        this.menuInstance.clickedFolder = 15 - this.scroller.scrollTop + (e.offsetY & 0xFFFFF0);

        this.resizeFull();
        this.redraw(e);
    }

    getDirFqn = (folder,heightIn,level,target, parentFqn) => {
        let height = heightIn;
        const dirs = Object.keys(folder).sort();
        const fl = folder.$F.length;
        for (let i = NUM_META_FOLDERS, l = dirs.length; i < l; i++) {
            const curDir = folder[dirs[i]];
            const tFqn = parentFqn !== "" ? `${parentFqn}.${dirs[i]}` : dirs[i];
            if (height === target) {
                return tFqn;
            }
            if (curDir.$O === 2) {
                height = this.getDirFqn(curDir, height + FILETREE_HEIGHT, level + FILETREE_HEIGHT, target, tFqn);
                if (typeof height === "string") {
                    return height;
                }
            } else {
                height += FILETREE_HEIGHT
            }
        }
        return height;
    }
    
    clickFolder = (folder,heightIn,level,target) => {
        let height = heightIn;
        const dirs = Object.keys(folder).sort();
        const fl = folder.$F.length;
        for (let i = NUM_META_FOLDERS, l = dirs.length; i < l; i++) {
            const curDir = folder[dirs[i]];
            if (height === target) {
                if (curDir.$O === 0)
                    curDir.$F.sort(nodeFolderSort);
                curDir.$O = (curDir.$O === 2) ? 1 : 2;
                this.resizeFull();
                this.redraw();
                return 0
            }
            if (curDir.$O === 2) {
                height = this.clickFolder(curDir, height + FILETREE_HEIGHT, level + FILETREE_HEIGHT, target);
                if (height === 0)
                    return 0
            } else {
                height += FILETREE_HEIGHT
            }
        }
        for (let i = 0; i < fl; i++) {
            if (height === target) {
                folder.$F[i].render(this.renderTarg, this.dataContainer, (val) => {
                    currentNode = val;
                });
                return 0
            }
            height += FILETREE_HEIGHT
        }
        return height
    }
    
    resizeFull = () => {
        this.scrollercon.style.width = '500px';
        this.scrollercon.style.height = (5 + this.resizeDir(this.nodesByFqn)) + 'px'
    }
    
    resizeDir = (folder) => {
        let height = 0;
        const dirs = Object.keys(folder);
        for (let i = NUM_META_FOLDERS, l = dirs.length; i < l; i++) {
            const dir = folder[dirs[i]];
            if (dir.$O === 2) {
                height += this.resizeDir(dir)
            }
        }
        height += (dirs.length - NUM_META_FOLDERS + folder.$F.length) * FILETREE_HEIGHT;
        return height
    }
}

class GomTree {
    constructor () {
        this.nodesByFqn = new NodesByFqn();
        this.nodesList = {};
        this.loadedBuckets = 0;
        this.loadedPrototypes = 0;
        this.bulkCallback = null;
    }

    initRenderer(treeList, viewContainer, dataContainer) {
        this.viewContainer = viewContainer;
        this.dataContainer = dataContainer;
        this.nodeTree = new NodeTree(treeList, viewContainer, dataContainer, this);
    }

    /**
     * Adds a node to the Gom tree, and saves the created nodeElem to a dictionary
     * @param {NodeEntr} node A Node object representing the node entry data from the node reader.
     */
    addNode(node) {
        let name = node.fqn;
        this.nodesList[name] = node;
        let curFolder = this.nodesByFqn;
        let folderStart = 0;
        let i = 0;
        for (; i < name.length; i++) {
            if (name[i] === '.') {
                const folderName = name.substring(folderStart, i);
                if (folderStart === 0 && i > 8) {
                    curFolder = curFolder._misc
                }
                let tmpFolder = curFolder[folderName];
                if (!tmpFolder) {
                    tmpFolder = Object.create(null);
                    tmpFolder.$F = [];
                    tmpFolder.$O = 0;
                    curFolder[folderName] = tmpFolder
                }
                curFolder = tmpFolder;
                folderStart = i + 1
            }
        }
        node.path = name.substring(0, folderStart);
        const fileName = name.substring(folderStart, i);
        node.fileName = fileName;
        if (curFolder.$O === 0) {
            curFolder.$F.push(node)
        } else {
            let insertIndex = 0;
            for (let j = 0, l = curFolder.$F.length; j < l; j++) {
                if (curFolder.$F[j].fileName <= fileName) {
                    insertIndex++
                } else {
                    break
                }
            }
            curFolder.$F.splice(insertIndex, 0, node)
        }
    }

    renderNodeByFQN(fqn) {
        let hasFound = false;
        const tree = fqn.split(".");
        if (tree.length > 0) {
            let parent = this.nodesByFqn;
            for (let i = 0; i < tree.length; i++) {
                const elem = tree[i];
                const fqnObj = parent[elem];
                if (i + 1 == tree.length) {
                    const tNode = parent.$F.find((val, idx) => { return val.fileName == elem; });
                    if (tNode) {
                        hasFound = true
                        tNode.render(this.viewContainer, this.dataContainer, (val) => {
                            currentNode = val;
                        });
                    }
                    break
                } else if (fqnObj) {
                    parent = fqnObj;
                } else {
                    break
                }
            }
        } else {
            const tNode = this.nodesByFqn.$F.find((val, idx) => { return val.fileName == tree[0]; });
            if (tNode) {
                hasFound = true;
                tNode.render(this.viewContainer, this.dataContainer, (val) => {
                    currentNode = val;
                });
            }
        }
    
        return hasFound;
    }
}

function nodeFolderSort(a, b) {
    if (a.fileName < b.fileName)
        return -1;
    if (a.fileName === b.fileName)
        return 0;
    return 1
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

export {GomTree, NodesByFqn, nodeFolderSort, currentNode};