import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appJsonPath = path.join(root, 'app.json');
const packageJsonPath = path.join(root, 'package.json');
const packageLockPath = path.join(root, 'package-lock.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function bumpPatch(version) {
  const parts = String(version).split('.').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Versao invalida para bump automatico: ${version}`);
  }
  parts[2] += 1;
  return parts.join('.');
}

const explicitVersion = process.env.APP_VERSION?.trim();
const explicitVersionCode = process.env.ANDROID_VERSION_CODE?.trim();

const appJson = readJson(appJsonPath);
const packageJson = readJson(packageJsonPath);
const packageLock = fs.existsSync(packageLockPath) ? readJson(packageLockPath) : null;

const currentVersion = appJson.expo?.version ?? packageJson.version;
const currentVersionCode = Number(appJson.expo?.android?.versionCode ?? 0);

const nextVersion = explicitVersion || bumpPatch(currentVersion);
const nextVersionCode = explicitVersionCode ? Number(explicitVersionCode) : currentVersionCode + 1;

if (!Number.isInteger(nextVersionCode) || nextVersionCode <= currentVersionCode) {
  throw new Error(`versionCode precisa ser maior que ${currentVersionCode}. Recebido: ${nextVersionCode}`);
}

appJson.expo.version = nextVersion;
appJson.expo.android.versionCode = nextVersionCode;
packageJson.version = nextVersion;

if (packageLock) {
  packageLock.version = nextVersion;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = nextVersion;
  }
}

writeJson(appJsonPath, appJson);
writeJson(packageJsonPath, packageJson);
if (packageLock) writeJson(packageLockPath, packageLock);

const output = [
  `version=${nextVersion}`,
  `version_code=${nextVersionCode}`,
  `previous_version=${currentVersion}`,
  `previous_version_code=${currentVersionCode}`,
].join('\n');

console.log(output);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
}
