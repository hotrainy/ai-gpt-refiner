import { execSync } from 'child_process';
import { deleteNodeModules, getRootDir } from './helpers.js';

const config = {
    skipGit: proc