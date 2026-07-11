/**
 * cleanupDuplicateIndexes.js
 *
 * Diagnoses and fixes the "Too many keys specified; max 64 keys allowed"
 * error caused by repeated `sequelize.sync({ alter: true })` runs.
 *
 * Root cause: every time alter-sync runs, Sequelize sometimes fails to
 * recognize that a unique/foreign-key index already exists on a table
 * (e.g. `users.email`) and adds a new one instead of reusing it. MySQL
 * allows at most 64 indexes per table, so after enough dev restarts a
 * table fills up with functionally-identical duplicate indexes and every
 * further ALTER TABLE on it fails - even unrelated ones.
 *
 * What this script does:
 *   1. Scans every table in the configured database.
 *   2. Groups indexes by their (uniqueness + ordered column list) signature.
 *   3. Any group with more than one index is a duplicate set - keeps one,
 *      flags the rest for removal.
 *   4. By default just PRINTS a report (safe, read-only).
 *   5. With --execute, actually drops the duplicate indexes, keeping data
 *      and one working copy of each index intact.
 *
 * Usage:
 *   node scripts/cleanupDuplicateIndexes.js                # dry run (report only)
 *   node scripts/cleanupDuplicateIndexes.js --execute       # actually drop duplicates
 *   node scripts/cleanupDuplicateIndexes.js --table=users   # limit to one table
 *   node scripts/cleanupDuplicateIndexes.js --execute --table=users
 *
 * Safe to re-run - once duplicates are gone, it reports "no duplicates
 * found" and does nothing.
 */

const sequelize = require("../src/config/database");

const EXECUTE = process.argv.includes("--execute");
const tableArg = process.argv.find((a) => a.startsWith("--table="));
const ONLY_TABLE = tableArg ? tableArg.split("=")[1] : null;

const WARN_THRESHOLD = 55; // heads-up before hitting MySQL's hard 64-key cap

async function getTables() {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  const names = rows.map((r) => r.TABLE_NAME);
  return ONLY_TABLE ? names.filter((n) => n === ONLY_TABLE) : names;
}

async function getIndexes(tableName) {
  // One row per (index, column) pair, ordered so columns come back in
  // their correct position within each index (SEQ_IN_INDEX).
  const [rows] = await sequelize.query(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    { replacements: [tableName] }
  );

  const byName = new Map();
  for (const row of rows) {
    if (!byName.has(row.INDEX_NAME)) {
      byName.set(row.INDEX_NAME, {
        name: row.INDEX_NAME,
        unique: Number(row.NON_UNIQUE) === 0,
        columns: [],
      });
    }
    byName.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
  }
  return [...byName.values()];
}

function groupDuplicates(indexes) {
  // Never touch PRIMARY - that's the primary key, not a candidate.
  const candidates = indexes.filter((i) => i.name !== "PRIMARY");

  const groups = new Map();
  for (const idx of candidates) {
    const signature = `${idx.unique ? "UNIQUE" : "INDEX"}:${idx.columns.join(",")}`;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(idx);
  }

  // Only groups with more than one index are duplicates.
  return [...groups.entries()]
    .filter(([, idxs]) => idxs.length > 1)
    .map(([signature, idxs]) => ({
      signature,
      // Keep the shortest/alphabetically-first name (typically the
      // original, explicitly- or first-auto-named index); drop the rest.
      keep: idxs.slice().sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))[0],
      drop: idxs
        .slice()
        .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
        .slice(1),
    }));
}

async function dropIndex(tableName, indexName) {
  await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
}

async function main() {
  console.log(EXECUTE ? "Running in EXECUTE mode - duplicate indexes will be dropped.\n" : "Running in DRY-RUN mode (default). Pass --execute to actually apply changes.\n");

  await sequelize.authenticate();
  const tables = await getTables();

  let totalDuplicatesFound = 0;
  let totalDropped = 0;
  let totalFailed = 0;

  for (const table of tables) {
    const indexes = await getIndexes(table);
    const indexCount = indexes.length;
    const dupGroups = groupDuplicates(indexes);

    const nearLimit = indexCount >= WARN_THRESHOLD;
    if (dupGroups.length === 0 && !nearLimit) continue;

    console.log(`\n=== ${table} ===`);
    console.log(`  Total indexes: ${indexCount}${nearLimit ? "  ⚠️  approaching MySQL's 64-index limit" : ""}`);

    if (dupGroups.length === 0) {
      console.log("  No duplicate indexes found.");
      continue;
    }

    for (const group of dupGroups) {
      totalDuplicatesFound += group.drop.length;
      console.log(`  Duplicate set [${group.signature}]:`);
      console.log(`    keep:  ${group.keep.name}`);
      for (const idx of group.drop) {
        console.log(`    ${EXECUTE ? "drop:  " : "would drop:"} ${idx.name}`);
        if (EXECUTE) {
          try {
            await dropIndex(table, idx.name);
            totalDropped++;
          } catch (err) {
            totalFailed++;
            console.log(`      ✗ failed to drop ${idx.name}: ${err.message}`);
          }
        }
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Duplicate indexes found: ${totalDuplicatesFound}`);
  if (EXECUTE) {
    console.log(`Dropped successfully:    ${totalDropped}`);
    if (totalFailed) console.log(`Failed to drop:          ${totalFailed}`);
  } else if (totalDuplicatesFound > 0) {
    console.log("\nThis was a dry run - nothing was changed.");
    console.log("Re-run with --execute to actually drop the duplicates:");
    console.log("  node scripts/cleanupDuplicateIndexes.js --execute");
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error("Script failed:", err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
