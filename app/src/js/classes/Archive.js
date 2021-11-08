import { FileWrapper } from './FileWrapper.js';

const { promises: { readFile }, readFileSync, open, read } = require('fs');
const path = require('path');

class ArchiveEntryTable {
    constructor(capacity, offset) {
        this.capacity = capacity;
        this.offset = offset;
    }
}

class ArchiveEntry {
    constructor(offset, metaDataSize, comprSize, uncomprSize, metaDataCheckSum, comprType, ph, sh, fileTableNum, fileTableFileIdx) {
        this.offset = offset;
        this.metaDataSize = metaDataSize;
        this.comprSize = comprSize;
        this.uncomprSize = uncomprSize;
        this.metaDataCheckSum = metaDataCheckSum;
        this.comprType = comprType;
        this.ph = ph;
        this.sh = sh;
        this.fileTableNum = fileTableNum;
        this.fileTableFileIdx = fileTableFileIdx;
    }
}

class Archive {
    constructor(file, idx, loadTables = false) {
        this.file = file;
        this.idx = idx;
        this.tables = [];
        this.entries = {};

        this.data = new FileWrapper(this.file);

        let mypHeader = this.data.read(0x24);
        if (mypHeader.readUint32() !== 0x50594d) throw new Error(`ARCHIVEERROR at indexidx: ${this.idx}. Not a .tor file (Wrong file header)`);
        
        this.version = mypHeader.readUint32();
        if (this.version !== 5) throw new Error(`ARCHIVEERROR at indexidx: ${this.idx}. Only version 5 is supported, file has ${datView.getUint32(4, true)}`);
        
        this.bom = mypHeader.readUint32()
        if (this.bom !== 0xFD23EC43) throw new Error(`ARCHIVEERROR at indexidx: ${this.idx}. Unexpected byte order`);

        this.tableOffset = mypHeader.readUint64();
        if (this.tableOffset === 0) throw new Error(`ARCHIVEERROR at indexidx: ${this.idx}. File is empty`);

        this.tableCapacity = mypHeader.readUint32();
        this.totalFiles = mypHeader.readUint32();
        if (loadTables) {
            this.#readFileTables();
        }
    }

    async #readFileTables() {
        console.log('loading archive line 37');
        const fileName = path.basename(this.file);

        this.entries = {};
        while (this.tableOffset > 0n) {
            this.data.seek(this.tableOffset, 0);
            let fileTableHeader = this.data.read(0xC);
            this.tableCapacity = fileTableHeader.readUint32();
            this.tableOffset = fileTableHeader.readUint64(); // not sure if this is correct, or line after is

            // this.tableOffset = dv.getUint32(4, !0); // not sure if this is correct, or line before is

            let fileTable = this.data.read(this.tableCapacity * 0x22);
            const table = new ArchiveEntryTable(this.tableCapacity, this.tableOffset);
            const tableIdx = this.tables.length;
            this.tables.push(table);

            for (let i = 0; i < this.tableCapacity; ++i) {
                let offset = fileTable.readUint64();
                if (offset === 0) continue;
                const headerSize = fileTable.readUint32();

                const comprSize = fileTable.readUint32();
                const uncomprSize = fileTable.readUint32();
                const sh = fileTable.readUint32();
                const ph = fileTable.readUint32();
                const crc = fileTable.readUint32();

                if (sh === 0xC75A71E6 && ph === 0xE4B96113) continue;
                if (sh === 0xCB34F836 && ph === 0x8478D2E1) continue;
                if (sh === 0x02C9CF77 && ph === 0xF077E262) continue;

                const compression = fileTable.readUint8();
                const fileObj = new ArchiveEntry(
                    offset,
                    headerSize,
                    (compression !== 0) ? comprSize : 0,
                    uncomprSize,
                    crc,
                    compression !== 0,
                    ph,
                    sh,
                    tableIdx,
                    i
                );

                const hash = fileObj.sh + '|' + fileObj.ph;
                this.entries[hash] = fileObj;
            }
        }
    }
}

export {Archive};