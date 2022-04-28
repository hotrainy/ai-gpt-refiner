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

export const getR