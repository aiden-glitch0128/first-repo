"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kkutkkaji-state-v1";

const emptyState = {
  projectTitle: "내 첫 책",
  dailyChars: 500,
  streak: 0,
  lastCompletedDate: null,
  items: [],
  materialGoal: 40,
  editorialReviews: [],
};

const stageLabel = {
  material: "소재",
  selected: "채택",
  draft: "초안",
  manuscript: "원고",
};

function todayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
}

function nextMission(items, dailyChars) {
  const materials = items.filter((i) => i.stage === "material");
  const selected = items.filter((i) => i.stage === "selected");
  const drafts = items.filter((i) => i.stage === "draft");
  const manuscripts = items.filter((i) => i.stage === "manuscript");

  if (materials.length < 10) {
    return {
      kind: "collect",
      title: "소재 1개 적기",
      description: "떠오른 생각 하나를 제목과 한두 문장으로 남기세요.",
    };
  }

  if (selected.length < 5 && materials.length > 0) {
    return {
      kind: "select",
      title: "소재 1개 채택하기",
      description: "모아둔 소재 중 책에 들어갈 가능성이 있는 하나를 고르세요.",
      targetId: materials[0].id,
    };
  }

  const selectedWithoutDraft = selected.find(
    (s) => !drafts.some((d) => d.parentId === s.id)
  );

  if (selectedWithoutDraft) {
    return {
      kind: "draft",
      title: `「${selectedWithoutDraft.title}」 초안 ${dailyChars}자 쓰기`,
      description: "완성하려고 하지 말고 끝까지 밀어붙이세요.",
      targetId: selectedWithoutDraft.id,
    };
  }

  if (drafts.length > manuscripts.length && drafts.length > 0) {
    const target = drafts.find(
      (d) => !manuscripts.some((m) => m.parentId === d.id)
    ) || drafts[0];

    return {
      kind: "revise",
      title: `「${target.title}」 원고로 갈무리하기`,
      description: "초안을 읽고 삭제·보강한 뒤 원고 단계로 넘기세요.",
      targetId: target.id,
    };
  }

  return {
    kind: "collect",
    title: "다음 장을 위한 소재 1개 적기",
    description: "책을 앞으로 밀 새로운 재료 하나를 추가하세요.",
  };
}

export default function Home() {
  const [state, setState] = useState(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setState({ ...emptyState, ...JSON.parse(raw) });
      } catch {}
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const mission = useMemo(
    () => nextMission(state.items, state.dailyChars),
    [state.items, state.dailyChars]
  );

  const counts = useMemo(() => {
    return ["material", "selected", "draft", "manuscript"].reduce((acc, stage) => {
      acc[stage] = state.items.filter((i) => i.stage === stage).length;
      return acc;
    }, {});
  }, [state.items]);

  const materialRoots = useMemo(() => state.items.filter((i) => !i.parentId), [state.items]);
  const materialCount = materialRoots.length;
  const materialGoal = Math.max(1, Number(state.materialGoal) || 40);
  const materialPercent = Math.min(100, Math.round(materialCount / materialGoal * 100));
  const reachedMilestone = [100, 75, 50].find((m) => materialPercent >= m) || 0;
  const reviewedMilestones = new Set((state.editorialReviews || []).map((r) => r.milestone).filter(Boolean));
  const pendingMilestone = [50, 75, 100].find((m) => materialPercent >= m && !reviewedMilestones.has(m)) || 0;
  const latestReview = (state.editorialReviews || [])[0];
  const completedToday = state.lastCompletedDate === todayKey();
  const denominator =
    counts.material + counts.selected + counts.draft + counts.manuscript || 1;
  const progress = Math.round(
    ((counts.selected + counts.draft * 2 + counts.manuscript * 3) /
      (denominator * 3)) *
      100
  );

  function addMaterial() {
    if (!newTitle.trim()) return;
    setState((s) => ({
      ...s,
      items: [
        {
          id: crypto.randomUUID(),
          title: newTitle.trim(),
          body: newBody.trim(),
          stage: "material",
          createdAt: new Date().toISOString(),
        },
        ...s.items,
      ],
    }));
    setNewTitle("");
    setNewBody("");
  }

  function promote(item) {
    const order = ["material", "selected", "draft", "manuscript"];
    const idx = order.indexOf(item.stage);
    if (idx === order.length - 1) return;

    if (item.stage === "selected") {
      const draft = {
        id: crypto.randomUUID(),
        parentId: item.id,
        title: item.title,
        body: item.body || "",
        stage: "draft",
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, items: [draft, ...s.items] }));
      return;
    }

    if (item.stage === "draft") {
      const manuscript = {
        id: crypto.randomUUID(),
        parentId: item.id,
        title: item.title,
        body: item.body || "",
        stage: "manuscript",
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, items: [manuscript, ...s.items] }));
      return;
    }

    setState((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === item.id ? { ...i, stage: order[idx + 1] } : i
      ),
    }));
  }

  function updateBody(id, body) {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, body } : i)),
    }));
  }

  function completeMission() {
    if (completedToday) return;
    const today = todayKey();
    const continues = state.lastCompletedDate === yesterdayKey();
    setState((s) => ({
      ...s,
      lastCompletedDate: today,
      streak: continues ? s.streak + 1 : 1,
    }));
  }

  async function runEditorialReview() {
    if (reviewLoading || !materialCount) return;
    setReviewLoading(true);
    setReviewError("");
    try {
      const response = await fetch("/api/editorial-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle: state.projectTitle,
          materialGoal,
          items: materialRoots.map((i) => ({ title: i.title, body: i.body || "" })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.review) throw new Error(result.error || "분석에 실패했습니다.");
      const record = { ...result.review, id: crypto.randomUUID(), milestone: pendingMilestone || null, materialCount, createdAt: new Date().toISOString() };
      setState((current) => ({ ...current, editorialReviews: [record, ...(current.editorialReviews || [])] }));
    } catch (error) {
      setReviewError(error.message || "분석에 실패했습니다.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoreError("");
    try {
      if (file.size > 5_000_000) throw new Error("5MB 이하의 백업 파일만 복원할 수 있습니다.");
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.items) || typeof parsed.projectTitle !== "string" ||
        parsed.items.some((i) => !i || typeof i.id !== "string" || typeof i.title !== "string" ||
          typeof i.stage !== "string" || !["material","selected","draft","manuscript"].includes(i.stage))) {
        throw new Error("끝까지 백업 파일 형식이 아닙니다.");
      }
      if (!window.confirm("현재 브라우저의 프로젝트 데이터를 백업 파일로 교체할까요? 먼저 현재 데이터를 백업하는 것을 권장합니다.")) return;
      setState({ ...emptyState, ...parsed, materialGoal: Math.max(1, Math.min(500, Number(parsed.materialGoal) || 40)), editorialReviews: Array.isArray(parsed.editorialReviews) ? parsed.editorialReviews : [] });
    } catch (error) {
      setRestoreError(error.message || "백업 복원에 실패했습니다.");
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kkutkkaji-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) return null;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">끝까지 · Day {Math.max(state.streak, 1)}</div>
          <input
            className="projectTitle"
            value={state.projectTitle}
            onChange={(e) =>
              setState((s) => ({ ...s, projectTitle: e.target.value }))
            }
            aria-label="책 프로젝트 이름"
          />
          <p className="subtitle">책 한 권을 끝내기 위한 집필 시스템</p>
        </div>
        <div className="backupActions">
          <button className="ghost" onClick={exportBackup}>JSON 백업</button>
          <label className="ghost restoreButton">복원<input type="file" accept=".json,application/json" onChange={restoreBackup} hidden /></label>
        </div>
      </section>

      {restoreError && <p role="alert" className="errorMessage">{restoreError}</p>}
      <section className="editorialPanel panel">
        <div className="panelHead"><h3>AI 편집국 · 소재 수집</h3><span>{materialPercent}%</span></div>
        <div className="goalLine">
          <span>수집한 소재 <strong>{materialCount}개</strong> / 목표</span>
          <label><input type="number" min="1" max="500" value={materialGoal}
            onChange={(e) => setState((current) => ({ ...current, materialGoal: Math.max(1, Math.min(500, Number(e.target.value) || 1)) }))} aria-label="목표 소재 개수" />개</label>
        </div>
        <div className="goalTrack" role="progressbar" aria-valuenow={materialPercent} aria-valuemin={0} aria-valuemax={100} aria-label="소재 수집 진행률"><div style={{ width: `${materialPercent}%` }} /></div>
        <div className="milestoneLabels"><span>시작</span><span>50% 리뷰</span><span>75% 리뷰</span><span>100%</span></div>
        {pendingMilestone > 0 && <p className="milestoneNotice">🎯 {pendingMilestone}% 마일스톤에 도달했어. 지금까지의 소재를 AI 편집장과 검토해보자.</p>}
        {!pendingMilestone && reachedMilestone > 0 && <p className="milestoneNotice">현재 {reachedMilestone}% 구간이야. 필요할 때 언제든 추가 리뷰를 요청할 수 있어.</p>}
        <button className="secondary reviewButton" onClick={runEditorialReview} disabled={reviewLoading || !materialCount}>
          {reviewLoading ? "편집장이 소재를 분석하는 중..." : pendingMilestone ? `${pendingMilestone}% AI 편집 회의 시작` : "AI 편집장에게 소재 검토 요청"}
        </button>
        {reviewError && <p role="alert" className="errorMessage">{reviewError}</p>}
        {latestReview && <div className="reviewResult">
          <div className="panelHead"><h3>최근 편집 회의</h3><span>{new Date(latestReview.createdAt).toLocaleDateString("ko-KR")}</span></div>
          <p><strong>종합 의견</strong><br />{latestReview.summary}</p>
          <p><strong>주제 연결성</strong><br />{latestReview.connections}</p>
          <p><strong>소재 다양성</strong><br />{latestReview.diversity}</p>
          <p><strong>보완할 부분</strong><br />{latestReview.gaps}</p>
          <p><strong>갈무리 준비도</strong><br />{latestReview.readiness}</p>
          <p className="nextAction"><strong>다음 행동</strong><br />{latestReview.nextAction}</p>
          {latestReview.questions?.length > 0 && <div><strong>함께 생각할 질문</strong><ul>{latestReview.questions.map((q, index) => <li key={index}>{q}</li>)}</ul></div>}
          <small>편집장의 제안은 자동으로 원고를 변경하지 않아. 최종 결정은 저자의 몫이야.</small>
        </div>}
        <p className="privacyNote">AI 검토를 요청하면 소재 제목과 내용이 외부 AI 서비스로 전송돼. 검토 결과는 현재 브라우저에 저장돼.</p>
      </section>
      <section className="missionCard">
        <span className="missionLabel">오늘 책을 앞으로 밀 일</span>
        <h2>{mission.title}</h2>
        <p>{mission.description}</p>
        <button
          className="primary"
          onClick={completeMission}
          disabled={completedToday}
        >
          {completedToday ? "오늘 미션 완료 ✓" : "오늘 미션 완료"}
        </button>
      </section>

      <section className="stats">
        <div><strong>{progress}%</strong><span>진행률</span></div>
        <div><strong>{state.streak}일</strong><span>연속 집필</span></div>
        <div><strong>{counts.manuscript}</strong><span>완성 원고</span></div>
        <div><strong>{state.items.length}</strong><span>전체 작업</span></div>
      </section>

      <section className="grid">
        <div className="panel composer">
          <div className="panelHead">
            <h3>소재 넣기</h3>
            <span>{counts.material}개</span>
          </div>
          <input
            placeholder="예: 제주에서 처음 혼자 장 본 날"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            placeholder="지금은 짧아도 됨. 떠오른 생각만 붙잡아두기."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <button className="secondary" onClick={addMaterial}>소재 추가</button>
        </div>

        <div className="panel">
          <div className="panelHead">
            <h3>집필 파이프라인</h3>
            <label className="daily">
              하루 기준
              <input
                type="number"
                min="100"
                step="100"
                value={state.dailyChars}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    dailyChars: Math.max(100, Number(e.target.value) || 500),
                  }))
                }
              />
              자
            </label>
          </div>

          <div className="pipeline">
            {["material", "selected", "draft", "manuscript"].map((stage) => (
              <div className="column" key={stage}>
                <div className="columnTitle">
                  <span>{stageLabel[stage]}</span>
                  <b>{counts[stage]}</b>
                </div>
                <div className="cards">
                  {state.items
                    .filter((i) => i.stage === stage)
                    .slice(0, 6)
                    .map((item) => (
                      <article className="note" key={item.id}>
                        <h4>{item.title}</h4>
                        {(stage === "draft" || stage === "manuscript") && (
                          <textarea
                            value={item.body}
                            onChange={(e) => updateBody(item.id, e.target.value)}
                            placeholder="여기에 계속 쓰기..."
                          />
                        )}
                        {stage !== "manuscript" && (
                          <button onClick={() => promote(item)}>
                            {stage === "material"
                              ? "채택"
                              : stage === "selected"
                              ? "초안 시작"
                              : "원고로"}
                          </button>
                        )}
                      </article>
                    ))}
                  {counts[stage] === 0 && (
                    <div className="empty">아직 없음</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="footer">
        v0.2 — 데이터와 편집 회의 기록은 이 브라우저에 저장됩니다. JSON 백업을 정기적으로 내려받아 주세요.
      </p>
    </main>
  );
}
