import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import { Field, Select } from "../../components/ui/FormField";
import { averageBand } from "../../utils/gradeBands";
import { Trophy, Info, AlertTriangle, BookOpen, Star } from "lucide-react";

// Same tone mapping used on Reports.jsx's Grade column — a class average
// and its per-grade counts read the same color everywhere in the app.
function gradeColorClasses(grade) {
  const bandByGrade = {
    A: 85,
    B: 74,
    C: 64,
    Pass: 55,
    Fail: 20,
  };
  return averageBand(bandByGrade[grade] ?? 0);
}

// A minimal three-stat summary row, shown only when a teacher is class
// teacher for more than one class — plain numbers, no colored tiles, so it
// doesn't compete with the per-class breakdowns below it.
function OverviewRow({ overallAverage, bestClass, weakestClass }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-3 border border-slate-200 rounded-2xl px-5 py-4 mb-6">
      <div>
        <div className="text-xs text-slate-400 mb-0.5">Overall Average</div>
        <div className="text-xl font-bold text-slate-800">
          {overallAverage !== null ? `${overallAverage}%` : "N/A"}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-0.5">Best Class</div>
        {bestClass ? (
          <div className="text-xl font-bold text-slate-800">
            {bestClass.className} <span className="text-sm font-medium text-slate-400">{bestClass.average}%</span>
          </div>
        ) : (
          <div className="text-sm text-slate-400">—</div>
        )}
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-0.5">Needs Attention</div>
        {weakestClass ? (
          <div className="text-xl font-bold text-slate-800">
            {weakestClass.className} <span className="text-sm font-medium text-slate-400">{weakestClass.average}%</span>
          </div>
        ) : (
          <div className="text-sm text-slate-400">—</div>
        )}
      </div>
    </div>
  );
}

// One class-teacher class's full breakdown: header stat, grade spread,
// top 5 / slow learners side-by-side with real separation between them,
// then a plain module performance list with the best module called out.
function ClassStatsBlock({ c }) {
  return (
    <div className="border border-slate-200 rounded-2xl p-5 sm:p-6">
      {/* Header: class name + the three headline numbers, kept plain and
          text-based instead of colored badges/pills, so nothing competes
          for attention. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-1">
        <h4 className="font-semibold text-slate-800 text-base">{c.className}</h4>
        {c.classAverage !== null && (
          <span className="text-xs text-slate-400">
            {c.studentsRanked}/{c.totalStudents} student{c.totalStudents === 1 ? "" : "s"} ranked
          </span>
        )}
      </div>

      {c.classAverage === null ? (
        <p className="text-sm text-slate-400 mt-2">No marks recorded yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 mt-2 mb-4">
            <div>
              <span className={`text-2xl font-bold ${averageBand(c.classAverage).text}`}>{c.classAverage}%</span>
              <span className="text-xs text-slate-400 ml-1.5">class average</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-700">{c.classPassRate}%</span>
              <span className="text-xs text-slate-400 ml-1.5">pass rate</span>
            </div>
          </div>

          {c.gradeDistribution && c.gradeDistribution.length > 0 && (
            <div className="mb-6">
              <div className="h-2 rounded-full overflow-hidden flex bg-slate-100">
                {(() => {
                  const total = c.gradeDistribution.reduce((sum, d) => sum + d.count, 0);
                  return total === 0
                    ? null
                    : c.gradeDistribution.map((d) =>
                        d.count > 0 ? (
                          <div
                            key={d.grade}
                            className={gradeColorClasses(d.grade).bar}
                            style={{ width: `${(d.count / total) * 100}%` }}
                            title={`${d.grade}: ${d.count}`}
                          />
                        ) : null
                      );
                })()}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                {c.gradeDistribution.map((d) => (
                  <span key={d.grade}>
                    {d.grade} <span className="text-slate-600 font-medium">{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Top performers / slow learners — a visible divider and generous
          gap so the two lists read as clearly separate, not one blur. */}
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6 mb-6 sm:divide-x sm:divide-slate-100">
        <div>
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Trophy size={13} /> Top 5 Performers
          </h5>
          {c.topLearners.length === 0 ? (
            <p className="text-sm text-slate-400">No ranked students yet.</p>
          ) : (
            <ul className="space-y-2">
              {c.topLearners.map((s, idx) => (
                <li key={s.studentId} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-700 min-w-0">
                    <span className="w-4 shrink-0 text-xs font-medium text-slate-400">{idx + 1}</span>
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="font-medium text-slate-700 shrink-0">{s.weightedAverage}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sm:pl-10">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Below 50%
          </h5>
          {c.slowLearners.length === 0 ? (
            <p className="text-sm text-slate-400">No student is currently below 50%.</p>
          ) : (
            <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {c.slowLearners.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{s.name}</span>
                  <span className="font-medium text-red-500 shrink-0">{s.weightedAverage}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Module performance — plain list, no table chrome. Best module is
          just marked with a star and bold text, not a colored callout box. */}
      <div className="pt-5 border-t border-slate-100">
        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BookOpen size={13} /> Module Performance
        </h5>
        {c.moduleBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400">No module scores recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {c.moduleBreakdown.map((m) => {
              const isBest = c.bestModule && m.moduleId === c.bestModule.moduleId;
              return (
                <li key={m.moduleId} className="flex items-center justify-between text-sm gap-3">
                  <span className="flex items-center gap-1.5 text-slate-700 min-w-0">
                    {isBest && <Star size={13} className="text-amber-400 shrink-0" fill="currentColor" />}
                    <span className={`truncate ${isBest ? "font-medium" : ""}`}>{m.title}</span>
                  </span>
                  <span className="flex items-baseline gap-3 shrink-0 tabular-nums">
                    <span className={`font-medium ${averageBand(m.average).text}`}>{m.average}%</span>
                    <span className="text-xs text-slate-400 w-16 text-right">{m.passRate}% pass</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function TeacherStatistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termId, setTermId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await api.get("/statistics/teacher", {
        params: termId ? { termId } : {},
      });
      setData(data);
      if (!termId && data.term) setTermId(String(data.term.id));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  if (loading && !data) {
    return <Loader label="Loading your statistics…" />;
  }

  if (!data || !data.academicYear) {
    return (
      <Card>
        <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>No academic year is set up yet — statistics will appear once the school year is active.</span>
        </div>
      </Card>
    );
  }

  const hasClasses = data.classes && data.classes.length > 0;

  return (
    <div>
      <Card
        title="Class Performance"
        subtitle={`${data.academicYear.name}${data.term ? ` · ${data.term.name}` : ""}`}
        actions={
          data.availableTerms.length > 0 && (
            <Field label="">
              <Select value={termId} onChange={(e) => setTermId(e.target.value)} className="min-w-[160px]">
                {data.availableTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )
        }
      >
        {!hasClasses ? (
          <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>Statistics are only shown for classes you're the class teacher of — you aren't a class teacher this year.</span>
          </div>
        ) : !data.term ? (
          <p className="text-sm text-slate-400">No terms available yet.</p>
        ) : loading ? (
          <Loader label="Updating…" size="sm" />
        ) : data.classes.every((c) => c.studentsRanked === 0) ? (
          <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>No marks have been recorded yet for this term, so statistics aren't available.</span>
          </div>
        ) : (
          <>
            {data.classes.length > 1 && (
              <OverviewRow
                overallAverage={data.overallAverage}
                bestClass={data.bestClass}
                weakestClass={data.weakestClass}
              />
            )}

            <div className="flex flex-col gap-5">
              {data.classes.map((c) => (
                <ClassStatsBlock key={c.classId} c={c} />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

