/**
 * PoaFi Shared Hosting Builder & Packager
 *
 * Run from the project root:
 *   node build-shared-host.js
 *
 * What it does:
 * 1. Compiles poafi-backend TypeScript -> poafi-backend/dist/
 * 2. Builds & static-exports poafi-frontend -> poafi-frontend/out/ (with .htaccess for Apache/LiteSpeed)
 * 3. Copies poafi-frontend/out/ into poafi-backend/public/ so poafi-backend can also serve
 *    both the frontend website and /api/* from a single cPanel Node.js application.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'poafi-backend');
const frontendDir = path.join(rootDir, 'poafi-frontend');
const frontendOutDir = path.join(frontendDir, 'out');
const backendPublicDir = path.join(backendDir, 'public');

function runNodeScript(cwd, scriptRelPath, args = []) {
  const scriptPath = path.join(cwd, scriptRelPath);
  console.log(`\n▶ Running: node ${scriptRelPath} ${args.join(' ')} (in ${path.basename(cwd)})`);
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env },
  });
}

function main() {
  console.log('==========================================================');
  console.log('🚀 Building PoaFi for Shared Hosting (cPanel / Passenger)');
  console.log('==========================================================');

  // 1. Compile Backend
  runNodeScript(backendDir, 'node_modules/typescript/bin/tsc');
  console.log('✅ Backend compiled to poafi-backend/dist/');

  // 2. Build Static Frontend Export
  runNodeScript(frontendDir, 'node_modules/next/dist/bin/next', ['build']);
  console.log('✅ Frontend exported to poafi-frontend/out/');

  // 3. Copy static export into poafi-backend/public for Single-App cPanel mode
  if (fs.existsSync(frontendOutDir)) {
    fs.rmSync(backendPublicDir, { recursive: true, force: true });
    fs.cpSync(frontendOutDir, backendPublicDir, { recursive: true });
    console.log('✅ Copied static frontend into poafi-backend/public/');
  }

  console.log('\n==========================================================');
  console.log('🎉 Shared Hosting Build Complete!');
  console.log('==========================================================');
  console.log('Option A (1-App cPanel Node.js Setup):');
  console.log('  Upload poafi-backend/ (now includes public/ frontend + app.js) to cPanel');
  console.log('  and set Application Startup File = app.js');
  console.log('');
  console.log('Option B (Apache/LiteSpeed public_html + API subdomain):');
  console.log('  1. Upload contents of poafi-frontend/out/ (includes .htaccess) to public_html/');
  console.log('  2. Upload poafi-backend/ to cPanel Node.js App on api.yourdomain.co.tz');
  console.log('==========================================================');
}

main();
