/**
 * dedupeAssignmentsAndModules.js
 *
 * One-time cleanup for duplicate rows in `class_modules` and
 * `teacher_module_assignments` — the "a teacher's modules show up twice
 * after a new academic year is created" bug.
 *
 * Root cause: creating a new academic year carries forward each class's
 * modules and module-teacher assignments from the previous year. The query
 * that read them eager-loaded two separate hasMany associations (ClassModule
 * and TeacherModuleAssignment) on Class in one go, which makes Sequelize
 * build a single SQL JOIN across both — and that join cross-multiplies rows
 * (a class with 3 modules and 3 assignments comes back as 9 joined rows
 * instead of 3+3). Those multiplied rows then got bulk-created as genuine
 * duplicate rows in both tables.
 *
 * Both tables were already modeled with a unique index meant to prevent
 * exactly this (`class_modules` on class_id+module_id, and
 * `teacher_module_assignments` on teacher_id+module_id+class_id+
 * academic_year_id) — but this project's `sequelize.sync()` only ever
 * CREATES missing tables, it never ALTERs existing ones (see server.js /
 * DB_SYNC_ALTER), so if either table already existed before that index was
 * added to the model, the live database never actually got the constraint.
 * That's how the duplicate rows made it past the model definition.
 *
 * The application code that caused the duplication has separately been
 * fixed (academicYearController.js). This script cleans up the data that's
 * already duplicated, and adds the unique index to the live database if
 * it's missing, so this specific failure mode can't happen again even from
 * a future bug.
 *
 * What it does:
 *   1. Scans `class_modules` for rows sharing the same (class_id,
 *      module_id) and `teacher_module_assignments` for rows sharing the
 *      same (teacher_id, module_id, class_id, academic_year_id).
 *   2. For each duplicate group, keeps the lowest id, marks the rest for
 *      deletion.
 *   3. By default just PRINTS a report (safe, read-only).
 *   4. With --execute: deletes the duplicate rows, then checks whether each
 *      table's unique index actually exists in the database and adds it if
 *      not — so the constraint is enforced going forward regardless of any
 *      future application-level bug.
 *
 * Usage (from the backend/ folder):
 *   node scripts/dedupeAssignmentsAndModules.js             # dry run (report only)
 *   node scripts/dedupeAssignmentsAndModules.js --execute   # actually delete + add indexes
 *
 * Safe to re-run — once duplicates are gone and the indexes exist, it
 * reports "nothing to do" and makes no changes.
 */

require("dotenv").config();
const sequelize = require("../src/config/database");

const EXECUTE = process.argv.includes("--execute");

async function findDuplicateGroups(table, keyColumns) {
  const cols = keyColumns.join(", ");
  const [rows] = await sequelize.query(
    `SELECT id, ${cols} FROM \`${table}\` ORDER BY ${cols}, id ASC`
  );

  const groups = new Map();
  for (const row of rows) {
    const key = keyColumns.map((c) => row[c]).join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.id);
  }

  return [...groups.values()].filter((ids) => ids.length > 1);
}

async function deleteDuplicates(table, dupGroups) {
  let deleted = 0;
  for (const ids of dupGroups) {
    const [, keepId, ...dropIds] = [null, ...ids]; // first id kept, rest dropped
    if (dropIds.length === 0) continue;
    await sequelize.query(`DELETE FROM \`${table}\` WHERE id IN (${dropIds.join(",")})`);
    deleted += dropIds.length;
  }
  return deleted;
}

async function uniqueIndexExists(table, columns) {
  const [rows] = await sequelize.query(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [table] }
  );

  const byIndex = new Map();
  for (const r of rows) {
    if (!byIndex.has(r.INDEX_NAME)) byIndex.set(r.INDEX_NAME, { unique: Number(r.NON_UNIQUE) === 0, cols: [] });
    byIndex.get(r.INDEX_NAME).cols[r.SEQ_IN_INDEX - 1] = r.COLUMN_NAME;
  }

  for (const idx of byIndex.values()) {
    if (idx.unique && idx.cols.join(",") === columns.join(",")) return true;
  }
  return false;
}

async function ensureUniqueIndex(table, indexName, columns) {
  const exists = await uniqueIndexExists(table, columns);
  if (exists) {
    console.log(`  Unique index already exists on ${table} (${columns.join(", ")}) — nothing to add.`);
    return false;
  }
  console.log(`  Adding missing unique index ${indexName} on ${table} (${columns.join(", ")})...`);
  await sequelize.query(
    `ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${columns.map((c) => `\`${c}\``).join(", ")})`
  );
  return true;
}

async function processTable(table, keyColumns, indexName) {
  console.log(`\n=== ${table} ===`);
  const dupGroups = await findDuplicateGroups(table, keyColumns);
  const dupRowCount = dupGroups.reduce((sum, g) => sum + (g.length - 1), 0);

  if (dupGroups.length === 0) {
    console.log("  No duplicate rows found.");
  } else {
    console.log(`  Found ${dupGroups.length} duplicate group(s), ${dupRowCount} extra row(s) to remove.`);
    for (const ids of dupGroups) {
      console.log(`    keep: ${ids[0]}   ${EXECUTE ? "delete:" : "would delete:"} ${ids.slice(1).join(", ")}`);
    }
    if (EXECUTE) {
      const deleted = await deleteDuplicates(table, dupGroups);
      console.log(`  Deleted ${deleted} duplicate row(s).`);
    }
  }

  if (EXECUTE) {
    // Only safe to add the unique constraint once duplicates are gone —
    // otherwise the ALTER TABLE itself would fail on the remaining dupes.
    await ensureUniqueIndex(table, indexName, keyColumns);
  } else {
    const exists = await uniqueIndexExists(table, keyColumns);
    console.log(`  Unique index on (${keyColumns.join(", ")}): ${exists ? "present" : "MISSING — will be added with --execute"}`);
  }

  return dupRowCount;
}

async function main() {
  console.log(
    EXECUTE
      ? "Running in EXECUTE mode — duplicates will be deleted and missing unique indexes added.\n"
      : "Running in DRY-RUN mode (default). Pass --execute to actually apply changes.\n"
  );

  await sequelize.authenticate();

  const totalClassModuleDupes = await processTable(
    "class_modules",
    ["class_id", "module_id"],
    "class_modules_class_id_module_id"
  );

  const totalAssignmentDupes = await processTable(
    "teacher_module_assignments",
    ["teacher_id", "module_id", "class_id", "academic_year_id"],
    "tma_unique_assignment"
  );

  console.log("\n--- Summary ---");
  console.log(`class_modules duplicate rows:               ${totalClassModuleDupes}`);
  console.log(`teacher_module_assignments duplicate rows:  ${totalAssignmentDupes}`);
  if (!EXECUTE && (totalClassModuleDupes > 0 || totalAssignmentDupes > 0)) {
    console.log("\nThis was a dry run — nothing was changed.");
    console.log("Re-run with --execute to actually clean this up:");
    console.log("  node scripts/dedupeAssignmentsAndModules.js --execute");
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error("Script failed:", err.message);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
