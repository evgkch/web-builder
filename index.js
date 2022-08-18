#!/usr/bin/env -S node --experimental-modules

import fs from 'fs';
import url from 'url';
import process from 'process';
import path from 'path';
import getEncoding from "detect-file-encoding-and-language";

JSON.fetch = async function(filePath) {
    const encoding = await getEncoding(filePath);
    return JSON.parse(await fs.promises.readFile(filePath, encoding));
};

const colors = {
	Error: '\x1b[41m%s\x1b[0m',
	Message: '\x1b[36m%s\x1b[0m',
	Ok: '\x1b[32m%s\x1b[0m'
};

const WebBuilder = async () => {

    // Dependencies map
    const hash_to_modules = {};
    const module_to_hash = {};
    // Load and parse package-lock.json
    const lock = await JSON.fetch(path.join(process.cwd(), 'package-lock.json'));
    if (lock.dependencies) {
        // Iterate for all not dev dependecies
        for (const module_name in lock.dependencies) if (!lock.dependencies[module_name].dev) {
            // Get hash from version or use folder as hash instead
            // Ex.: git+ssh://git@github.com/evgkch/channeljs.git#d4fa47343d6b08d2e6982b0d5e915b4f4437fd3a -> d4fa47343d6b08d2e6982b0d5e915b4f4437fd3a
            const hash = lock.dependencies[module_name].version.match(/#(.*)/)?.[1] || module_name;
            // Check a folder doest not exist
            if (module_name in module_to_hash) {
                console.log(colors.Error, `'${module_name}' module is already exists in dependecies. Rename module by handle`);
                process.exit(1);
            }
            module_to_hash[module_name] = hash;
            // Add (hash, name) to the map
            if (hash) {
                if (!(hash in hash_to_modules)) {
                    hash_to_modules[hash] = [];
                }
                hash_to_modules[hash].push(module_name);
            }
        }
    }
    // Load and parse package.josn
    const project_config = await JSON.fetch(path.join(process.cwd(), 'package.json'));
    // Get dist folder
    const project_dist = path.parse(path.join(process.cwd(), project_config.main || project_config.browser)).dir;
    // Create dependecies names in dist folder
    for (let hash in hash_to_modules) {
        // Get module name
        const module_name = hash_to_modules[hash].values().next().value;
        // Get module path in node_modules
        const module_folder = path.join(process.cwd(), 'node_modules', module_name);
        // Load and parse module package.json
        const module_config = await JSON.fetch(path.join(module_folder, 'package.json'));
        // Get path to module dist
        const module_dist = path.join(module_folder, path.parse(module_config.main || module_config.browser).dir);
        // Copy module dist to project dist with resolved module name (see the hash above)
        fs.cp(module_dist, path.join(project_dist, hash), { recursive: true }, err => {
            if (err) {
                console.log(colors.Error, `Can't copy ${module_dist} to ${path.join(project_dist, hash)}`);
                process.exit(1);
            }
        });
    }

    // Create path-to-module.json from module_to_hash
    const file = path.join(process.cwd(), 'path-to-module.json');
    // Delete file if exists
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
    // Write file
    fs.writeFile(file, JSON.stringify(module_to_hash, null, '\t'), 'utf8', err => {
        if (err) {
            console.log(colors.Error, 'Can\'t create path-to-module.json');
        }
    });

};

async function main() {
    await WebBuilder();
}

main();