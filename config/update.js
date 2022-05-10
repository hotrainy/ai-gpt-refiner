import { execSync } from 'child_process';
import { deleteNodeModules, getRootDir } from './helpers.js';

const config = {
    skipGit: process.argv.includes('-g'),
};

// Set the directories
const rootDir = getRootDir();
const directories = [rootDir];

(async () => {
    console.green(
        'Starting update script, this may take a minute or two depending on your system and network.',
    );

    const { skipGit } = config;
    if (!skipGit) {
    // Fetch latest repo
        console.p