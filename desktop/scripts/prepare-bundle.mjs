import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const standaloneSource = path.join(projectRoot, ".next", "standalone");
const staticSource = path.join(projectRoot, ".next", "static");
const publicSource = path.join(projectRoot, "public");
const bundleRoot = path.join(projectRoot, "dist", "desktop-bundle");
const bundleStaticTarget = path.join(bundleRoot, ".next", "static");
const bundlePublicTarget = path.join(bundleRoot, "public");

if (!fs.existsSync(standaloneSource)) {
  throw new Error("Missing .next/standalone. Run the Next build before preparing the desktop bundle.");
}

fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(bundleRoot), { recursive: true });
fs.cpSync(standaloneSource, bundleRoot, { recursive: true });

if (fs.existsSync(staticSource)) {
  fs.mkdirSync(path.dirname(bundleStaticTarget), { recursive: true });
  fs.cpSync(staticSource, bundleStaticTarget, { recursive: true });
}

if (fs.existsSync(publicSource)) {
  fs.cpSync(publicSource, bundlePublicTarget, { recursive: true });
}

console.log(`Desktop bundle prepared at ${bundleRoot}`);
