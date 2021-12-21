const fs = require('fs');
const stream = require('stream');
const readLine = require('readline');

class PRTParser {
    #dest;
    /**
     * stb parser class
     * @param  {string} dest destination for ouputted hashes
     * @param  {string} ext extentions to search
     */
    constructor(dest, ext) {
        this.#dest = dest;
        this.extension = ext;
        this.fileNames = [];
        this.errors = [];
    }

    async parsePRT(data, _) {
        const reader = new stream.PassThrough();
        reader.end(data);

        const rl = readLine.createInterface({
            input: reader,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            let test = line.replace("  .", "");
            test = test.replace("Name=", "");
            test = test.replace("EmitSpec=", "");
            test = test.replace("Trail", "");
            test = test.replace("Texture_Purple", "");
            test = test.replace("Texture_Blue", "");
            test = test.replace("Texture_Red", "");
            test = test.replace("Texture_Green", "");
            test = test.replace("Texture_White", "");
            test = test.replace("Texture_Yellow", "");
            test = test.replace("Texture_Orange", "");
            test = test.replace("Texture", "/");
            test = test.replace("GrannyFile", "");
            test = test.replace("EmitFXSpec=", "");
            test = test.replace("EmitAtDeathSpec=", "");
            test = test.replace("=", "");
            test = test.replace("\\", "/");
            test = test.replace("//", "/");
            test = test.toLowerCase();

            if (test.includes(".prt")) {
                if (!test.includes("/art/fx/particles/")) {
                    this.fileNames.push("/resources/art/fx/particles/" + test);
                } else {
                    this.fileNames.push("/resources" + test);
                }
            } else if (test.includes(".dds")) {
                this.fileNames.push("/resources" + test);
                this.fileNames.push("/resources" + test.replace(".dds", ".tiny.dds"));
                this.fileNames.push("/resources" + test.replace(".dds", ".tex"));
            } else if (test.includes(".fxspec")) {
                this.fileNames.push("/resources" + test);
            } else if (test.includes(".gr2")) {
                this.fileNames.push("/resources" + test);
            }
        }
    }

    genHash() {
        const res = [...this.fileNames.map(file => file.replace("\\", "/"))];
        return res;
    }

    writeFile() {
        if (!fs.existsSync(`${this.#dest}\\File_Names`)) fs.mkdirSync(`${this.#dest}\\File_Names`);
        if (this.fileNames.length > 0) {
            const outputNames = fs.createWriteStream(`${this.#dest}\\File_Names\\${this.extension}_file_names.txt`, {
                flags: 'a'
            });
            for (const file of this.fileNames) {
                outputNames.write(`${file.replace("\\", "/")}\r\n`);
            }
            outputNames.end();
        }

        if (this.errors.length > 0) {
            const outputErrors = fs.createWriteStream(`${this.#dest}\\File_Names\\${this.extension}_error_list.txt`, {
                flags: 'a'
            });
            for (const error of this.errors) {
                outputErrors.write(`${error}\r\n`);
            }
            outputErrors.end();
        }
    }
}

export {PRTParser}