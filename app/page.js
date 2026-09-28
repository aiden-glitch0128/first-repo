"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kkutkkaji-state-v1";

const emptyState = {
  projectTitle: "내 첫 책",
  dailyChars: 500,
  streak: 0,
  lastCompletedDate: null,
  items: [],
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
        <button className="ghost" onClick={exportBackup}>백업</button>
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
        v0.1 — 데이터는 이 브라우저에 저장됩니다. Obsidian Vault 직접 연동은 다음 단계에서 붙입니다.
      </p>
    </main>
  );
}
