/**
 * Splits or reassembles the rockyou.txt wordlist so the large file
 * can be tracked in git via chunks under GitHub's 25 MB limit.
 *
 * Usage:
 *   node scripts/rockyou-parts.cjs split     # rockyou.txt -> rockyou.part.NN
 *   node scripts/rockyou-parts.cjs join      # rockyou.part.NN -> rockyou.txt
 *
 * Splitting is line-aware so no dictionary entries are broken across
 * chunks. Each chunk is kept under 24 MB.
 */
const fs = require('fs');
const path = require('path');

const DICT_DIR = path.join(__dirname, '..', 'public', 'dictionaries');
const FULL_PATH = path.join(DICT_DIR, 'rockyou.txt');
const MAX_CHUNK_BYTES = 24 * 1024 * 1024; // 24 MB — safely under GitHub's 25 MB limit

function split() {
  if (!fs.existsSync(FULL_PATH)) {
    console.error(`Cannot find ${FULL_PATH}. Nothing to split.`);
    process.exit(1);
  }

  // Read line by line to avoid loading 133 MB into memory at once.
  const input = fs.createReadStream(FULL_PATH, { encoding: 'utf8' });
  const readline = require('readline');
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let partNum = 1;
  let outStream = null;
  let currentSize = 0;
  const parts = [];

  function openNewPart() {
    const partPath = path.join(DICT_DIR, `rockyou.part.${String(partNum).padStart(2, '0')}`);
    outStream = fs.createWriteStream(partPath, { encoding: 'utf8' });
    currentSize = 0;
    parts.push(`rockyou.part.${String(partNum).padStart(2, '0')}`);
  }

  openNewPart();

  rl.on('line', (line) => {
    const data = line + '\n';
    const byteLen = Buffer.byteLength(data, 'utf8');
    if (currentSize + byteLen > MAX_CHUNK_BYTES && currentSize > 0) {
      outStream.end();
      partNum++;
      openNewPart();
    }
    outStream.write(data);
    currentSize += byteLen;
  });

  rl.on('close', () => {
    if (outStream) outStream.end();
    // Delete the original so git doesn't track it.
    fs.unlinkSync(FULL_PATH);
    console.log(`Split into ${parts.length} parts:`);
    for (const p of parts) {
      const sz = fs.statSync(path.join(DICT_DIR, p)).size;
      console.log(`  ${p}  (${(sz / (1024 * 1024)).toFixed(1)} MB)`);
    }
    console.log('Original rockyou.txt deleted. Run "node scripts/rockyou-parts.cjs join" to reassemble.');
  });

  rl.on('error', (err) => {
    console.error('Split failed:', err.message);
    process.exit(1);
  });
}

function join() {
  // Find all part files in order.
  const parts = fs.readdirSync(DICT_DIR)
    .filter((f) => /^rockyou\.part\.\d+$/.test(f))
    .sort();

  if (parts.length === 0) {
    console.error('No rockyou.part.* files found in', DICT_DIR);
    process.exit(1);
  }

  if (fs.existsSync(FULL_PATH)) {
    console.log('rockyou.txt already exists — skipping reassembly.');
    return;
  }

  const out = fs.createWriteStream(FULL_PATH, { encoding: 'utf8' });
  let totalBytes = 0;

  for (const part of parts) {
    const partPath = path.join(DICT_DIR, part);
    const data = fs.readFileSync(partPath, 'utf8');
    out.write(data);
    totalBytes += data.length;
  }

  out.end(() => {
    const stat = fs.statSync(FULL_PATH);
    console.log(`Reassembled rockyou.txt from ${parts.length} parts (${(stat.size / (1024 * 1024)).toFixed(1)} MB).`);
  });
}

const cmd = process.argv[2];
if (cmd === 'split') {
  split();
} else if (cmd === 'join') {
  join();
} else {
  console.error('Usage: node scripts/rockyou-parts.cjs [split|join]');
  process.exit(1);
}
