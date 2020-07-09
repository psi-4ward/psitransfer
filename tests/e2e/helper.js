import fs from 'fs';
import path from 'path';
import os from 'os';
import filecompare from 'filecompare';
import { t } from 'testcafe';

export const sharedData = {
  shareLink: null
};

/**
 * Wait for download to finish (max 5s)
 * @param {string} file name file
 * @return {Promise<boolean>}
 */
export async function waitForFileDownload(file) {
  const f = getFileDownloadPath(file);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(f)) {
      return true;

    }
    await t.wait(500);
  }
  return fs.existsSync(f);
}

/**
 * Get full download path for a file
 * @param {string} file
 * @return {string}
 */
export function getFileDownloadPath(file) {
  return path.join(os.homedir(), 'Downloads', file);
}

/**
 * Deletes a previously downladed file if it exists
 * @param {string} file
 */
export function clearDownloadedFile(file) {
  const f = getFileDownloadPath(file);
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
  }
}

export async function compareFiles(sourceFile, downloadedFile) {
  return new Promise((resolve, reject) => {
    const dlFile = getFileDownloadPath(downloadedFile);
    const srcFile = path.resolve(__dirname, '../../', sourceFile);
    filecompare(dlFile, srcFile, resolve);
  });
}
