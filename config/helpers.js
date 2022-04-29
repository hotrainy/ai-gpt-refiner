/**
 * Helper functions
 * This allows us to give the console some colour when running in a terminal
 *
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

export const getRootDir = (trajectory = '..') => {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    return path.resolve(dirname, trajectory);
};

export const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(`\x1b[36m${query}\n> \x1b[0m`, (ans) => {
        rl.close();
        resolve(ans);
    }));
};

export function isDockerRunning() {
    try {
        execSync('docker info');
        return true;
    } catch (e) {
        return false;
    }
}

export function deleteNodeModules(dir) {
    const nodeModulesPath =