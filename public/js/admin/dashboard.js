// admin_dashboard.js - Dashboard e pagina Analytics del pannello admin.
// - pageDashboard: 4 card stats + video recenti + utenti recenti + categorie
// - pageAnalytics: grafici a barre di views/utenti negli ultimi 30 giorni,
//   views per categoria, top tag
// Entrambe partono con skeleton e riempiono al ritorno delle Promise.

async function pageDashboard() {
  const pc = document.getElementById("pageContent");

  // Skeleton iniziale: 4 card grigie + 5 righe video + 4 righe utenti.
  // In questo modo la pagina non "salta" quando arrivano i dati veri.
  pc.innerHTML = `
    <div class="sg">
      ${Array(4)
        .fill("")
        .map(
          (_, i) => `
        <div class="sc" style="animation-delay:${0.05 + i * 0.07}s">
          <div style="display:flex;justify-content:space-between;margin-bottom:16px">${sk("100px", 14)}</div>
          ${sk("80px", 32)}
        </div>
      `
        )
        .join("")}
    </div>
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:24px" class="bg">
      <div class="card" style="animation-delay:.3s">
        <div class="card-h">
          <span class="outfit" style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Video recenti</span>
          <a class="btn-link" onclick="nav('videos')">Vedi tutti</a>
        </div>
        <div id="dVids">
          ${Array(5)
            .fill("")
            .map(
              () => `
            <div class="vrow">${sk("64px", 44)}<div style="flex:1">${sk("80%", 14)}${sk("40%", 12)}</div></div>
          `
            )
            .join("")}
        </div>
      </div>
      <div class="card" style="animation-delay:.4s">
        <div class="card-h">
          <span class="outfit" style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Ultimi utenti</span>
          <a class="btn-link" onclick="nav('users')">Vedi tutti</a>
        </div>
        <div id="dUsers">
          ${Array(4)
            .fill("")
            .map(
              () => `
            <div class="urow">${sk("40px", 40)}<div style="flex:1">${sk("60%", 14)}${sk("40%", 12)}</div></div>
          `
            )
            .join("")}
        </div>
      </div>
    </div>
    <div id="dCats" style="margin-top:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;opacity:0;animation:fu .5s ease .5s forwards"></div>
  `;

  try {
    // Fetch parallele: se una lenta rallenta l'altra, va bene comunque.
    const [stats, vids, users, cats] = await Promise.all([
      apiFetch("/stats"),
      apiFetch("/videos/recent?limit=5"),
      apiFetch("/users/recent?limit=4"),
      apiFetch("/categories"),
    ]);

    // Config delle 4 card in cima. l=label, v=valore, i=icona, c=colore,
    // d=delta settimanale (badge "+N questa settimana").
    const si = [
      {
        l: "Video totali",
        v: stats.videoTotali,
        i: "▶",
        c: "#0d7a4d",
        d: stats.recent?.new_videos,
      },
      {
        l: "Utenti registrati",
        v: stats.utentiRegistrati,
        i: "◉",
        c: "#1e9659",
        d: stats.recent?.new_users,
      },
      {
        l: "Visualizzazioni",
        v: stats.visualizzazioni,
        i: "◎",
        c: "#08562f",
        d: stats.recent?.new_views,
      },
      { l: "Commenti", v: stats.commenti, i: "◫", c: "#34d27e", d: stats.recent?.new_comments },
    ];

    document.querySelector(".sg").innerHTML = si
      .map(
        (s, i) => `
      <div class="sc" style="animation-delay:${0.05 + i * 0.07}s">
        <div class="blob" style="background:${s.c}"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:13px;font-weight:500;color:var(--text2)">${s.l}</span>
          <span style="width:40px;height:40px;border-radius:12px;background:${s.c}15;display:flex;align-items:center;justify-content:center;font-size:17px;color:${s.c}">${s.i}</span>
        </div>
        <div class="outfit" style="font-size:34px;font-weight:700;letter-spacing:-1px">${fn(s.v)}</div>
        ${s.d ? `<div style="font-size:12px;font-weight:500;color:${s.c};background:${s.c}10;display:inline-flex;padding:3px 10px;border-radius:20px;margin-top:6px">+${s.d} questa settimana</div>` : ""}
      </div>
    `
      )
      .join("");

    // Lista video recenti. cc(v.category) restituisce un colore
    // deterministico per categoria (definito in core.js).
    document.getElementById("dVids").innerHTML = vids.length
      ? vids
          .map((v) => {
            const c = cc(v.category);
            return `
            <div class="vrow" onclick="openVideoDetail(${v.id})">
              <div style="width:64px;height:44px;border-radius:10px;background:linear-gradient(135deg,${c}20,${c}40);border:1px solid ${c}30;display:flex;align-items:center;justify-content:center;color:${c};flex-shrink:0">▶</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.title)}</div>
                <div style="display:flex;gap:8px;margin-top:4px">
                  <span style="font-size:11px;font-weight:600;color:${c};background:${c}12;padding:2px 8px;border-radius:6px">${esc(v.category || "—")}</span>
                  <span style="font-size:11px;color:var(--text3)">${fd(v.created_at)}</span>
                </div>
              </div>
              <div style="font-size:13px;font-weight:600;color:var(--text2);flex-shrink:0">◎ ${fn(v.view_count)}</div>
            </div>
          `;
          })
          .join("")
      : '<div style="padding:24px;text-align:center;color:var(--text3)">Nessun video</div>';

    // Lista utenti recenti con avatar colorato.
    // fds() = format-data-short (es. "2g fa").
    document.getElementById("dUsers").innerHTML = users.length
      ? users
          .map((u, i) => {
            const c = COLORS[i % COLORS.length];
            return `
            <div class="urow" onclick="openUserDetail(${u.id})">
              <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,${c}30,${c}60);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:${c};text-transform:uppercase;flex-shrink:0;overflow:hidden">${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : u.username[0]}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:14px;font-weight:600">${esc(u.username)}</span>
                  ${u.role === "admin" ? '<span class="b-admin">Admin</span>' : u.role === "banned" ? '<span class="b-ban">Ban</span>' : ""}
                </div>
                <div style="font-size:12px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
              </div>
              <div style="font-size:12px;color:var(--text3);flex-shrink:0">${fds(u.created_at)}</div>
            </div>
          `;
          })
          .join("")
      : "";

    // Griglia categorie con conteggio video.
    document.getElementById("dCats").innerHTML = cats
      .map((c) => {
        const col = cc(c.name);
        return `
        <div style="background:var(--card);border-radius:12px;padding:16px 20px;border:1px solid var(--border);display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .25s;border-left:4px solid ${col}">
          <div style="width:10px;height:10px;border-radius:50%;background:${col}"></div>
          <span style="font-size:13px;font-weight:600">${esc(c.name)}</span>
          <span style="font-size:12px;color:var(--text3);margin-left:auto">${c.video_count} video</span>
        </div>
      `;
      })
      .join("");
  } catch (e) {
    // Se qualcosa nel Promise.all fallisce mostro uno stato di errore
    // con bottone Riprova che rilancia la funzione.
    document.getElementById("pageContent").innerHTML = `
      <div class="empty">
        <div class="empty-ico">!</div>
        <div class="empty-t">Errore</div>
        <div class="empty-d">${esc(e.message)}</div>
        <button class="btn btn-p" onclick="pageDashboard()">Riprova</button>
      </div>
    `;
  }
}

// Pagina Analytics: 4 grafici a barre.
// Grafici fatti a mano con div a altezza percentuale, senza librerie.
// Piu' semplice da spiegare rispetto a Chart.js e per dati piccoli
// (30 giorni, poche categorie) va piu' che bene.
async function pageAnalytics() {
  const pc = document.getElementById("pageContent");
  pc.innerHTML = `<div style="text-align:center;padding:40px">${sk("100%", 200)}</div>`;

  try {
    const data = await apiFetch("/analytics");
    // Max globali: servono a scalare le altezze delle barre in %.
    // Il "|| 1" evita la divisione per zero quando la serie e' vuota.
    const maxV = Math.max(...data.viewsDaily.map((d) => d.views), 1);
    const maxCat = Math.max(...data.catStats.map((c) => c.views), 1);

    pc.innerHTML = `
      <div class="analytics-grid">

        <div class="chart-card" style="animation-delay:.1s">
          <div class="chart-title">Visualizzazioni ultimi 30 giorni</div>
          <div class="mini-chart">
            ${data.viewsDaily
              .map(
                (d) => `
              <div class="mini-bar" style="height:${Math.max((d.views / maxV) * 100, 5)}%;flex:1" title="${d.day}: ${d.views}"></div>
            `
              )
              .join("")}
          </div>
          <div class="chart-legend"><span>Totale: <strong>${data.viewsDaily.reduce((a, d) => a + d.views, 0)}</strong></span></div>
        </div>

        <div class="chart-card" style="animation-delay:.2s">
          <div class="chart-title">Nuovi utenti ultimi 30 giorni</div>
          <div class="mini-chart">
            ${data.usersDaily
              .map((d) => {
                // Nota: mv si potrebbe calcolare fuori dal map cosi facendo
                // lo calcolo una volta sola. Lasciato dentro perche' funziona
                // ed e' comodo da leggere.
                const mv = Math.max(...data.usersDaily.map((x) => x.users), 1);
                return `<div class="mini-bar" style="height:${Math.max((d.users / mv) * 100, 5)}%;flex:1;background:#1e9659" title="${d.day}: ${d.users}"></div>`;
              })
              .join("")}
          </div>
          <div class="chart-legend"><span>Totale: <strong>${data.usersDaily.reduce((a, d) => a + d.users, 0)}</strong></span></div>
        </div>

        <div class="chart-card" style="animation-delay:.3s">
          <div class="chart-title">Views per categoria</div>
          <div class="cat-bars">
            ${data.catStats
              .map((c) => {
                const col = cc(c.name);
                // pct min 3% cosi le barre piccolissime restano visibili.
                const pct = maxCat ? Math.max((c.views / maxCat) * 100, 3) : 3;
                return `
                <div class="cat-bar-row">
                  <div class="cat-bar-name">${esc(c.name)}</div>
                  <div style="flex:1"><div class="cat-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${col},${col}aa)">${c.videos}v</div></div>
                  <div class="cat-bar-val">${fn(c.views)} views</div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>

        <div class="chart-card" style="animation-delay:.4s">
          <div class="chart-title"># Top Tag per utilizzo</div>
          <div class="cat-bars">
            ${data.tagStats
              .map((t, i) => {
                const col = COLORS[i % COLORS.length];
                const maxT = Math.max(...data.tagStats.map((x) => x.videos), 1);
                const pct = Math.max((t.videos / maxT) * 100, 3);
                return `
                <div class="cat-bar-row">
                  <div class="cat-bar-name">${esc(t.name)}</div>
                  <div style="flex:1"><div class="cat-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${col},${col}aa)">${t.videos}</div></div>
                  <div class="cat-bar-val">${t.videos} video</div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>

      </div>
    `;
  } catch (e) {
    pc.innerHTML = `
      <div class="empty">
        <div class="empty-ico">!</div>
        <div class="empty-t">Nessun dato analytics</div>
        <div class="empty-d">${esc(e.message)}</div>
      </div>
    `;
  }
}