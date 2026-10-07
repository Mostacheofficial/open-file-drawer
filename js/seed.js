// FICTIONAL demo data so the prototype has something to show.
// Names, institutions, results and requests are invented; ORCID iDs are checksum-valid but not real people.
//
// Report shape (also the machine-readable export format):
// { id, status: 'preprint'|'review'|'peer', visibility: 'public'|'pending', version, createdAt, updatedAt,
//   title, abstract, subfield, reactionClass, keywords[], authors[{name,affiliation,orcid,role}], submitter{...},
//   protocolId?, question, hypothesis, system, timeSpan,
//   metric, threshold, series[{label,n,catalyst,solvent,temp,time,best,outcome,isControl}],
//   experiments?[{id,series,catalyst,solvent,temp,time,result,control,notes}],
//   controls, analytics[], expected, observed, failureCategory, interpretation, limitations, deviations?,
//   dataLinks[], files[], license, doi, review, confirmation, flags[] }
(function () {
  'use strict';
  const O = window.NR_AUTH.makeOrcid;
  const inst = n => `${n}, Demo University`;
  const S = (label, n, catalyst, solvent, temp, time, best, outcome, isControl = false) =>
    ({ label, n, catalyst, solvent, temp, time, best, outcome, isControl });

  // deterministic pseudo-random numbers so the demo plots are stable
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function experimentsFor(series, seed) {
    const rand = rng(seed), out = [];
    let k = 1;
    series.forEach(s => {
      for (let i = 0; i < s.n; i++) {
        let v = s.isControl ? Math.min(100, Math.max(0, s.best - rand() * 8)) : s.best * Math.pow(rand(), 2.2);
        if (i === 0) v = s.best;
        out.push({ id: 'E' + pad(k++), series: s.label, catalyst: s.catalyst, solvent: s.solvent, temp: s.temp, time: s.time, result: Math.round(v * 10) / 10, control: !!s.isControl, notes: '' });
      }
    });
    return out;
  }
  const pad = n => String(n).padStart(3, '0');

  function mk(o, seed) {
    const first = o.authors[0];
    const rep = Object.assign({
      version: 1, visibility: 'public', flags: [], files: [], dataLinks: [], license: 'CC BY 4.0', doi: null, review: null, confirmation: null, demo: true,
      submitter: { name: first.name, orcid: first.orcid, method: 'orcid' }
    }, o);
    rep.nExperiments = rep.series.reduce((a, s) => a + s.n, 0);
    rep.experiments = experimentsFor(rep.series, seed);
    return rep;
  }
  const confirmed = (name, at) => ({ required: [{ name, role: 'pi', confirmedAt: at }], requestedAt: at, completedAt: at });

  const reports = [
    mk({
      id: 'NR-2026-0001', status: 'peer', createdAt: '2026-03-12T09:00:00Z', updatedAt: '2026-06-02T09:00:00Z',
      title: 'Pd-catalysed C(sp³)–H arylation of unprotected aliphatic amines: no productive turnover across 64 ligand/base combinations',
      abstract: 'We attempted a directed C(sp³)–H arylation of unprotected primary aliphatic amines with aryl bromides, based on a transient-directing-group concept. Over 64 ligand/base/additive combinations and 212 individual reactions we never observed more than 3% arylated product. Control reactions with a literature-precedented pivalamide substrate confirmed catalyst activity. Mass-balance and NMR analysis point to amine coordination poisoning the Pd(II) centre rather than to a failure of C–H activation itself.',
      subfield: 'Catalysis', reactionClass: 'C–H functionalisation', keywords: ['C–H activation', 'palladium', 'amines', 'ligand screening'],
      authors: [
        { name: 'Lena Hartmann', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000100'), role: '' },
        { name: 'Jonas Keller', affiliation: inst('Institute of Organic Chemistry'), orcid: '', role: '' },
        { name: 'Katharina Vogel', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000110'), role: 'pi' }
      ],
      confirmation: confirmed('Katharina Vogel', '2026-03-11T15:00:00Z'),
      question: 'Can unprotected primary aliphatic amines serve as their own directing group for Pd-catalysed γ-C(sp³)–H arylation when a transient aldehyde co-catalyst is added?',
      hypothesis: 'Imine formation in situ generates a bidentate N,N-chelate analogous to established amide-directed systems. Related transient-directing-group strategies work for benzylic amines, so extending them to unactivated aliphatic amines appeared plausible.',
      system: 'Primary amine substrates (n-butylamine, 2-methylbutylamine, cyclohexylmethylamine) + 4-bromoanisole or 4-bromobenzotrifluoride, Pd(OAc)₂ (10 mol%), glyoxylic acid as transient director.',
      timeSpan: 'Sep 2024 – Dec 2025', metric: 'Yield of arylated amine (%)', threshold: 30,
      series: [
        S('Ligand screen (mono-N-protected amino acids)', 48, 'Pd(OAc)₂ / MPAA ligands', 'HFIP / AcOH', '100', '24', 3, '≤ 3% product, ArBr largely unreacted'),
        S('Base / halide-scavenger screen', 56, 'Pd(OAc)₂ / L-Ac-Val', 'HFIP', '100', '24', 0, 'No product; Ag₂CO₃ gave Ar–Ar homocoupling'),
        S('Solvent and temperature variation', 60, 'Pd(OAc)₂ / L-Ac-Val', 'HFIP, TFE, t-AmylOH, DCE', '60–130', '12–48', 2, 'No useful product; decomposition > 120 °C'),
        S('Director loading and pre-formed imine', 28, 'Pd(OAc)₂', 'HFIP', '100', '24', 1, 'Pre-formed imine: Pd black after 2 h'),
        S('Positive control: pivalamide substrate', 20, 'Pd(OAc)₂ / L-Ac-Val', 'HFIP', '100', '24', 74, '68–74% arylation (as expected)', true)
      ],
      controls: 'Positive control: N-pivaloyl-2-methylbutylamine under identical conditions (68–74% yield). Negative controls: no Pd, no ligand, no director (all 0%). Each key condition run in duplicate.',
      analytics: ['NMR', 'LC-MS', 'GC-MS'],
      expected: 'Arylated amine in ≥ 30% yield for at least one ligand/base combination.',
      observed: 'Maximum 3% (LC-MS, internal standard). In most runs the aryl bromide was recovered unchanged and the amine was recovered as an imine/amine mixture.',
      failureCategory: 'catalyst-deactivation',
      interpretation: 'The positive control shows that the catalytic system is competent. Early Pd black formation with pre-formed imines suggests strong κ²-N,N coordination of the free amine/imine, leading to off-cycle Pd(II) complexes and reduction to Pd(0).',
      limitations: 'Only three amine substrates and two aryl bromides were examined. We did not isolate or crystallise the proposed off-cycle complex. Results do not rule out success with substantially different directors or oxidants.',
      dataLinks: ['https://example.org/demo-dataset/nr-2026-0001'],
      review: { editor: 'Dr. Mira Sandoval', reviewers: 2, decision: 'Accepted', date: '2026-06-02', note: 'Both reviewers considered the controls and mass-balance analysis sufficient; asked for explicit substrate scope limits, now included.' }
    }, 101),

    mk({
      id: 'NR-2026-0002', status: 'peer', createdAt: '2026-04-21T09:00:00Z', updatedAt: '2026-07-15T09:00:00Z',
      title: 'Blue-light photoredox decarboxylative alkynylation of α-amino acids: scope collapses beyond N-Boc glycine',
      abstract: 'A decarboxylative alkynylation using an organic photocatalyst and an ethynylbenziodoxolone reagent was expected to extend from N-Boc glycine to a broad range of α-amino acids. Across 14 amino acids and several irradiation set-ups only glycine and, in trace amounts, alanine gave product. Quantum-yield estimates and quenching studies indicate that the reagent, not the photocatalyst, is consumed by a competing pathway.',
      subfield: 'Photochemistry', reactionClass: 'Photoredox / photochemistry', keywords: ['photoredox', 'decarboxylation', 'alkynylation', 'amino acids'],
      authors: [{ name: 'Tomás Rivera', affiliation: inst('Department of Chemistry'), orcid: O('000000010000200'), role: '' }],
      question: 'Does decarboxylative alkynylation of N-Boc α-amino acids proceed beyond glycine under organic photoredox conditions?',
      hypothesis: 'Secondary alkyl radicals from alanine, valine and others are more stabilised than the glycine-derived radical and should be trapped at least as efficiently by the alkynyl reagent.',
      system: 'N-Boc α-amino acids (Gly, Ala, Val, Leu, Phe, Pro, …) + TIPS-EBX, 4CzIPN (2 mol%), Cs₂CO₃, DMF, 455 nm LEDs.',
      timeSpan: 'Jan 2025 – Jul 2025', metric: 'Yield of alkynylated product (%)', threshold: 40,
      series: [
        S('Amino-acid scope, standard conditions (13 amino acids, no Gly)', 13, '4CzIPN / TIPS-EBX', 'DMF', '25', '16', 6, 'Ala 6%; all others ≤ 2%'),
        S('Photocatalyst screen', 28, '4CzIPN, Ir(ppy)₃, Ru(bpy)₃, eosin Y', 'DMF', '25', '16', 5, 'No improvement for Ala/Val'),
        S('Light source / wavelength', 27, '4CzIPN', 'DMF', '25', '16–48', 4, '420, 455, 525 nm: same trend'),
        S('Reagent loading and addition rate', 30, '4CzIPN', 'DMF, MeCN', '25', '16', 3, 'EBX consumed within 1 h without product'),
        S('Positive control (N-Boc glycine)', 27, '4CzIPN', 'DMF', '25', '16', 74, '68–74% (consistent across batches)', true)
      ],
      controls: 'Dark and no-catalyst controls (0%); N-Boc glycine as positive control in every batch; photon flux measured with ferrioxalate actinometry.',
      analytics: ['NMR', 'HRMS', 'UV/Vis', 'LC-MS'],
      expected: 'Alkynylated products for ≥ 8 of 14 amino acids in > 40% yield.',
      observed: 'Only glycine reached useful yields. Alanine 6%; all others ≤ 2%.',
      failureCategory: 'low-yield',
      interpretation: 'Stern–Volmer studies show efficient reductive quenching of the photocatalyst by all carboxylates, so radical generation is not rate-limiting. ¹H NMR monitoring shows the EBX reagent decomposing in the presence of secondary-alkyl radical precursors; we propose a competing radical-polar crossover that destroys the reagent.',
      limitations: 'The competing pathway is inferred from consumption data and has not been isolated. Only N-Boc protection was examined.',
      review: { editor: 'Dr. Mira Sandoval', reviewers: 2, decision: 'Accepted', date: '2026-07-15', note: 'Reviewers requested actinometry data and a clearer statement of what was not tested.' }
    }, 102),

    mk({
      id: 'NR-2026-0003', status: 'review', createdAt: '2026-08-30T09:00:00Z', updatedAt: '2026-09-18T09:00:00Z',
      title: 'Electrochemical C–N coupling of azoles with arenes in flow: electrode passivation prevents steady-state operation',
      abstract: 'We tried to translate a batch electro-oxidative C–H/N–H coupling to continuous flow. Initial conversions were promising (up to 45%) but dropped to < 5% within 20 minutes in all 11 cell configurations. Post-run SEM/EDX and CV analysis show an insulating polymeric film on the anode. Pulsed-potential and polarity-reversal protocols delayed but did not prevent passivation.',
      subfield: 'Electrochemistry', reactionClass: 'Electrosynthesis', keywords: ['electrosynthesis', 'flow chemistry', 'C–H amination', 'passivation'],
      authors: [
        { name: 'Priya Nair', affiliation: inst('Institute of Technical Chemistry'), orcid: O('000000010000300'), role: '' },
        { name: 'Felix Brandt', affiliation: inst('Institute of Technical Chemistry'), orcid: '', role: '' }
      ],
      question: 'Can a batch electro-oxidative azole–arene coupling be run at steady state in a commercial flow electrolyser?',
      hypothesis: 'Short residence times and a high electrode-surface-to-volume ratio should suppress over-oxidation and polymerisation that limit batch yields.',
      system: 'Pyrazole + 1,3,5-trimethoxybenzene, Pt/C and BDD electrodes, MeCN/HFIP, Et₄NBF₄.',
      timeSpan: 'Feb 2025 – Aug 2025', metric: 'Steady-state conversion after 20 min (%)', threshold: 40,
      series: [
        S('Electrode material combinations', 20, 'Pt, BDD, glassy C', 'MeCN / HFIP', '25', '0.3', 5, 'Initial 20–45%, then < 5% within 20 min'),
        S('Flow rate and gap width', 24, 'BDD / Pt', 'MeCN / HFIP', '25', '0.1–1', 4, 'Same decay profile'),
        S('Pulsed / alternating polarity', 28, 'BDD / BDD', 'MeCN / HFIP', '25', '1', 9, 'Decay delayed to ~45 min'),
        S('Batch reference', 16, 'Pt / Pt', 'MeCN / HFIP', '25', '3', 58, '52–58% (reproducible)', true)
      ],
      controls: 'Batch reference run alongside every flow series; blank electrolyte CV before and after each run; no-current control (0%).',
      analytics: ['NMR', 'HPLC', 'Other'],
      expected: 'Stable ≥ 40% conversion over ≥ 2 h of continuous operation.',
      observed: 'Initial conversion up to 45% followed by rapid decay in every configuration.',
      failureCategory: 'scale-up',
      interpretation: 'CV and SEM/EDX indicate an insulating, nitrogen-rich polymer film. Film growth is faster in flow, probably because radical-cation intermediates are replenished at the anode surface at high local concentration.',
      limitations: 'Only one substrate pair was studied in detail. Mechanical or chemical in-situ cleaning was not tested.'
    }, 103),

    mk({
      id: 'NR-2026-0004', status: 'preprint', createdAt: '2026-09-09T09:00:00Z', updatedAt: '2026-09-09T09:00:00Z',
      title: 'Proline-derived organocatalysts for asymmetric aldol additions to α-ketoesters: no enantioinduction (< 5% ee) across 48 conditions',
      abstract: 'Five proline-derived catalysts were evaluated for aldol additions of acetone and cyclohexanone to ethyl pyruvate and ethyl benzoylformate. Conversion was good but enantioselectivity never exceeded 5% ee in 48 distinct conditions. Control reactions with 4-nitrobenzaldehyde reproduced literature ee values.',
      subfield: 'Organic synthesis', reactionClass: 'Asymmetric organocatalysis', keywords: ['organocatalysis', 'aldol', 'enantioselectivity', 'α-ketoesters'],
      authors: [{ name: 'Mei-Ling Tran', affiliation: inst('Department of Chemistry'), orcid: O('000000010000400'), role: '' }],
      question: 'Do proline-derived catalysts induce useful enantioselectivity in aldol additions to α-ketoesters?',
      hypothesis: 'The more electrophilic ketone should be activated by the same enamine/H-bond mechanism as aldehydes, with sufficient facial discrimination from the catalyst scaffold.',
      system: 'Acetone / cyclohexanone + ethyl pyruvate / ethyl benzoylformate; L-proline, prolinamide, diarylprolinol silyl ether, tetrazole and thiourea-proline catalysts.',
      timeSpan: 'Oct 2024 – Mar 2025', metric: 'Enantiomeric excess (% ee)', threshold: 60,
      series: [
        S('Catalyst screen', 20, '5 proline derivatives (20 mol%)', 'DMSO', '25', '48', 4, '40–85% conversion; ee 0–4%'),
        S('Solvent and additive screen', 40, 'Prolinamide', 'DMSO, DMF, CHCl₃, neat, + H₂O/AcOH', '25', '48', 5, 'ee ≤ 5%'),
        S('Low temperature', 16, 'Diarylprolinol silyl ether', 'CH₂Cl₂', '−20 – 0', '96', 3, 'Conversion < 15%, ee ≤ 3%'),
        S('Positive control (4-nitrobenzaldehyde)', 20, 'L-Proline', 'DMSO', '25', '24', 96, '93–96% ee (lit. 94%)', true)
      ],
      controls: 'Positive control with 4-nitrobenzaldehyde in every batch (ee reproduced). Racemic standards prepared with DBU. Background reaction without catalyst measured.',
      analytics: ['NMR', 'HPLC'],
      expected: '≥ 60% ee for at least one catalyst/solvent combination.',
      observed: 'ee never above 5%, even at high conversion.',
      failureCategory: 'low-yield',
      interpretation: 'Rapid, reversible aldol and possible retro-aldol racemisation of the tertiary alcohol product may erode ee; the background (uncatalysed) path is non-negligible with the highly electrophilic ketoesters.',
      limitations: 'Retro-aldol was not directly measured. Only two ketoesters and two donors were tested.'
    }, 104),

    mk({
      id: 'NR-2026-0005', status: 'preprint', createdAt: '2026-09-24T09:00:00Z', updatedAt: '2026-09-24T09:00:00Z',
      title: 'Solvothermal synthesis of a Zr-based MOF with a bent dicarboxylate linker: amorphous products at all tested modulator loadings',
      abstract: 'Targeting a hypothetical Zr₆-based framework with a bent 4,4′-sulfonyldibenzoate-type linker, we screened modulator type and loading, temperature and water content in 72 solvothermal syntheses. PXRD showed only amorphous material or the known UiO-66 impurity from linker decomposition in every case.',
      subfield: 'Materials / MOFs', reactionClass: 'Materials / MOF synthesis', keywords: ['MOF', 'zirconium', 'solvothermal', 'modulator'],
      authors: [{ name: 'David Okafor', affiliation: inst('Institute of Inorganic Chemistry'), orcid: O('000000010000500'), role: '' }],
      question: 'Can a Zr₆-oxo cluster be linked into a crystalline framework with a bent sulfonyl-bridged dicarboxylate?',
      hypothesis: 'Strong modulators (benzoic, formic and trifluoroacetic acid) slow nucleation sufficiently to allow ordering despite the flexible linker geometry.',
      system: 'ZrCl₄ + H₂L (bent dicarboxylic acid) in DMF with modulators.',
      timeSpan: 'Nov 2024 – Jun 2025', metric: 'Target crystalline phase (% PXRD phase fraction)', threshold: 50,
      series: [
        S('Modulator type × loading', 36, 'Benzoic acid, HCOOH, TFA (10–100 eq.)', 'DMF', '120', '48', 0, 'Amorphous (PXRD)'),
        S('Temperature / time', 20, 'Benzoic acid (30 eq.)', 'DMF', '80–150', '24–96', 0, 'Amorphous; > 140 °C linker decarboxylation'),
        S('Water content', 8, 'HCOOH (30 eq.)', 'DMF / H₂O', '120', '48', 0, 'UiO-66-type impurity only'),
        S('Positive control (BDC linker)', 8, 'Benzoic acid (30 eq.)', 'DMF', '120', '24', 100, 'Crystalline UiO-66 (surface area consistent with lit.)', true)
      ],
      controls: 'UiO-66 synthesis with terephthalic acid as positive control in each batch; linker stability tested separately by NMR after heating.',
      analytics: ['XRD / PXRD', 'NMR', 'IR'],
      expected: 'A new crystalline phase with PXRD reflections inconsistent with UiO-66.',
      observed: 'No new crystalline phase in any of 72 syntheses.',
      failureCategory: 'unexpected-product',
      interpretation: 'Linker flexibility likely favours disordered aggregates over a single connectivity; partial decarboxylation at higher temperature supplies terephthalate-like fragments that form UiO-66.',
      limitations: 'No single-crystal attempts; no other metals or cluster nuclearities tried.'
    }, 105),

    mk({
      id: 'NR-2026-0006', status: 'preprint', createdAt: '2026-10-02T09:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
      title: 'Ni-catalysed cross-electrophile coupling of unactivated alkyl chlorides: hydrodehalogenation dominates',
      abstract: 'We investigated Ni/bipyridine-catalysed cross-electrophile coupling of unactivated primary alkyl chlorides with aryl bromides using Mn or Zn as terminal reductant. Over 120 conditions, the dominant product was always the reduced alkane (up to 80%) and the coupling product never exceeded 6%.',
      subfield: 'Catalysis', reactionClass: 'Cross-coupling', keywords: ['nickel', 'cross-electrophile coupling', 'alkyl chlorides', 'reductive'],
      authors: [{ name: 'Sofia Lindqvist', affiliation: inst('Department of Chemistry'), orcid: O('000000010000600'), role: '' }],
      question: 'Can alkyl chlorides replace the more reactive bromides/iodides in Ni-catalysed reductive cross-electrophile coupling?',
      hypothesis: 'Halide exchange with NaI or Lewis-acid assistance generates a transient alkyl iodide in situ, enabling the established catalytic cycle.',
      system: 'n-Hexyl chloride + 4-bromoanisole, NiBr₂·diglyme / dtbbpy, Mn or Zn, DMA, additives NaI, TBAI, MgCl₂.',
      timeSpan: 'Jan 2025 – May 2025', metric: 'Yield of cross-coupled product (%)', threshold: 30,
      series: [
        S('Ligand screen', 30, 'NiBr₂·diglyme / bipy variants', 'DMA', '25–60', '24', 6, 'Coupling ≤ 6%; alkane 40–80%'),
        S('Halide-exchange additives', 40, 'NiBr₂·diglyme / dtbbpy', 'DMA', '40', '24', 5, 'NaI: faster alkane formation; no coupling gain'),
        S('Reductant and surface activation', 30, 'Ni / dtbbpy', 'DMA', '40', '24', 4, 'Zn: more dehalogenation; Mn: stalls'),
        S('Positive control (alkyl bromide)', 20, 'Ni / dtbbpy', 'DMA', '25', '16', 81, '72–81% coupling', true)
      ],
      controls: 'Alkyl bromide positive control each batch (72–81%). No-Ni and no-reductant negative controls gave no conversion.',
      analytics: ['GC-MS', 'NMR'],
      expected: 'Cross-coupled product in ≥ 30% yield for at least one additive/ligand set.',
      observed: 'Cross-coupling ≤ 6%; hydrodehalogenation up to 80%.',
      failureCategory: 'unexpected-product',
      interpretation: 'Slow oxidative addition into C–Cl lets the Ni–alkyl species build up at a reductant surface, favouring protonation/H-abstraction in DMA over transmetalation-type steps.',
      limitations: 'Only one alkyl chloride and one aryl bromide were studied; no mechanistic experiments (e.g. deuterium labelling) were done.'
    }, 106),

    mk({
      id: 'NR-2026-0007', status: 'preprint', createdAt: '2026-09-28T09:00:00Z', updatedAt: '2026-09-28T09:00:00Z',
      title: 'Cu-catalysed C–N coupling of ortho,ortho′-disubstituted aryl bromides with hindered anilines: no useful yield across four ligand classes',
      abstract: 'Following a pre-registered plan, we screened four ligand classes (diamines, β-diketones, phenanthrolines and, as a documented deviation, oxalamides) and eight bases for the Ullmann-type coupling of 2,6-disubstituted aryl bromides with 2,6-disubstituted anilines. None of 144 reactions exceeded 7% yield, while an unhindered control coupling gave 82–91%. Dehalogenation and aryl–aryl homocoupling accounted for most of the mass balance.',
      subfield: 'Catalysis', reactionClass: 'Amination / C–N coupling', keywords: ['copper', 'Ullmann', 'C–N coupling', 'steric hindrance', 'pre-registered'],
      authors: [
        { name: 'Hannah Brooks', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000700'), role: '' },
        { name: 'Samuel Adeyemi', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000800'), role: 'pi' }
      ],
      confirmation: confirmed('Samuel Adeyemi', '2026-09-27T12:00:00Z'),
      protocolId: 'NR-P-2026-0001',
      question: 'Can Cu/ligand systems couple doubly ortho-substituted aryl bromides with doubly ortho-substituted anilines to give tetra-ortho-substituted diarylamines?',
      hypothesis: 'Oxalamide- and diamine-ligated Cu(I) catalysts couple hindered partners in related systems. A broader ligand-class screen should reveal at least one system able to access tetra-ortho-substituted diarylamines in useful yield.',
      system: '2-Bromo-1,3-dimethylbenzene and analogues + 2,6-dimethyl- and 2,6-diisopropylaniline; CuI (10 mol%); 12 ligands in four classes; K₃PO₄, Cs₂CO₃ and six further bases; DMSO, dioxane, toluene.',
      timeSpan: 'Feb 2026 – Aug 2026', metric: 'Yield of diarylamine (%)', threshold: 30,
      series: [
        S('Ligand classes: diamines, β-diketones, phenanthrolines', 48, 'CuI (10 mol%) / ligands L1–L9', 'DMSO, dioxane', '90–120', '24', 5, 'All ≤ 5%; dehalogenation 30–60%'),
        S('Oxalamide ligands (added after series 1 — deviation)', 24, 'CuI (10 mol%) / oxalamides L10–L12', 'DMSO', '110–130', '24', 7, 'Best 7%; homocoupling observed'),
        S('Base and solvent screen (8 bases, 3 solvents)', 48, 'CuI / L10', 'DMSO, dioxane, toluene', '110', '24', 6, 'No base/solvent combination > 6%'),
        S('Temperature and concentration', 12, 'CuI / L10', 'DMSO', '90–140', '24', 4, 'Higher T: more dehalogenation'),
        S('Positive control (unhindered coupling)', 12, 'CuI / L10', 'DMSO', '110', '24', 91, '82–91% (4-bromotoluene + aniline)', true)
      ],
      controls: 'Unhindered positive control (4-bromotoluene + aniline) in every batch (82–91%). No-Cu and no-ligand controls: 0%. Duplicate runs for the five best conditions of each series.',
      analytics: ['NMR', 'GC-MS', 'LC-MS'],
      expected: 'Diarylamine in ≥ 30% yield for at least one ligand/base/solvent combination (as registered).',
      observed: 'Best result 7%; none of 132 hindered-substrate reactions reached the registered threshold. The registered stopping rule (no result above 10% after three series) was reached after series 3.',
      failureCategory: 'low-yield',
      interpretation: 'Dehalogenation and homocoupling dominate, consistent with steric blocking of the amine coordination/reductive-elimination step. The unhindered control shows that catalyst, ligand and base are active in principle.',
      limitations: 'Only Cu/ligand systems were tested; Pd-based systems were out of scope. Two aryl bromides and two anilines represent the hindered scope.',
      deviations: 'The oxalamide ligand class was not part of the registered plan. It was added after series 1 returned ≤ 5% for all ligands, to test a class reported for hindered couplings. All other steps followed the protocol.'
    }, 107)
  ];

  // ---- demo data for the review workflow (fictional people; .invalid addresses) ----
  const rb = (over = {}) => Object.assign({ coi: true, openReview: 'none', recommendation: 'minor', commentsEditor: '' }, over);
  const ratingsAll = (v, keys) => Object.fromEntries(keys.map(k => [k, v]));
  const RK = ['hypothesis', 'design', 'variation', 'controls', 'analytics', 'interpretation'];
  const r1 = reports.find(r => r.id === 'NR-2026-0001'), r3 = reports.find(r => r.id === 'NR-2026-0003'), r4 = reports.find(r => r.id === 'NR-2026-0004');
  // R1 is peer reviewed with two open reviews
  r1.review.reports = [
    { label: 'Reviewer 1', ratings: ratingsAll('yes', RK), recommendation: 'minor', openReview: 'anonymous', comments: 'The positive control and the mass-balance analysis make the negative result convincing. Please state the substrate limits explicitly in the abstract.' },
    { label: 'Dr. Lars Whitfield', ratings: { ...ratingsAll('yes', RK), variation: 'partly' }, recommendation: 'accept', openReview: 'signed', comments: 'A well-designed project. The ligand series could have included one bulkier amino-acid derivative, but the conclusion does not depend on it.' }
  ];
  r1.review.round = 1;
  // R3 is in review: one report received, one reviewer has accepted, the editor cannot decide yet (needs two)
  r3.reviewState = 'in_review'; r3.reviewRound = 1;
  r3.reviewProcess = { decisions: [], assignments: [
    Object.assign({ id: 'Ademo0001', round: 1, name: 'Dr. Lars Whitfield', email: 'lars@example.invalid', token: 'demo-reviewer-token-1', invitedAt: '2026-09-02T09:00:00Z', acceptedAt: '2026-09-03T09:00:00Z', declinedAt: null, declineReason: '', submittedAt: '2026-09-16T09:00:00Z', cancelledAt: null },
      { review: Object.assign(rb({ recommendation: 'minor', commentsAuthors: 'The passivation evidence (SEM/EDX and CV) is convincing. Please add the blank-electrolyte CV to the main text and state how many cells were examined after each run.', commentsEditor: 'Sound work; I would accept after the small additions.' }), { ratings: Object.assign(ratingsAll('yes', RK), { variation: 'partly' }) }) }),
    { id: 'Ademo0002', round: 1, name: 'Dr. Inès Moreau', email: 'ines@example.invalid', token: 'demo-reviewer-token-2', invitedAt: '2026-09-02T09:00:00Z', acceptedAt: '2026-09-05T09:00:00Z', declinedAt: null, declineReason: '', submittedAt: null, cancelledAt: null, review: null }
  ] };
  // R4 has been revised once: version 2 is current, version 1 stays visible
  const r4v1 = JSON.parse(JSON.stringify(r4));
  r4v1.controls = 'Positive control with 4-nitrobenzaldehyde in every batch (ee reproduced).';
  r4.version = 2; r4.versionNote = 'Controls section expanded after a reader’s question: racemic standards and the uncatalysed background reaction are now described.'; r4.versionCreatedAt = '2026-09-15T09:00:00Z';
  r4.versions = [{ version: 1, createdAt: r4.createdAt, note: '', data: r4v1 }];

  const protocols = [
    {
      id: 'NR-P-2026-0001', status: 'completed', createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-09-28T09:00:00Z', ipaAt: '2026-02-03T10:00:00Z',
      title: 'Cu-catalysed C–N coupling of ortho,ortho′-disubstituted aryl bromides with hindered anilines: ligand and base screen',
      subfield: 'Catalysis', reactionClass: 'Amination / C–N coupling', demo: true,
      authors: [
        { name: 'Hannah Brooks', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000700'), role: '' },
        { name: 'Samuel Adeyemi', affiliation: inst('Institute of Organic Chemistry'), orcid: O('000000010000800'), role: 'pi' }
      ],
      submitter: { name: 'Hannah Brooks', orcid: O('000000010000700'), method: 'orcid' },
      question: 'Can Cu/ligand systems couple doubly ortho-substituted aryl bromides with doubly ortho-substituted anilines?',
      hypothesis: 'Ligand-accelerated Ullmann-type couplings tolerate increasing steric hindrance with oxalamide and diamine ligands. A systematic screen across ligand classes should reveal whether tetra-ortho-substituted diarylamines are accessible with Cu.',
      system: '2-Bromo-1,3-dimethylbenzene and analogues + 2,6-disubstituted anilines; CuI; DMSO/dioxane/toluene; eight bases.',
      design: 'Series 1: nine ligands from three classes (diamines, β-diketones, phenanthrolines), two solvents (48 reactions). Series 2: base and solvent screen with the best ligand (48 reactions). Series 3: temperature and concentration (12 reactions). Duplicates for the five best conditions per series.',
      controls: 'Unhindered positive control (4-bromotoluene + aniline) in every batch; no-Cu and no-ligand negative controls.',
      analytics: ['NMR', 'GC-MS', 'LC-MS'],
      metric: 'Yield of diarylamine (%)', threshold: 30,
      successCriterion: 'At least one condition giving the diarylamine in ≥ 30% GC yield (average of duplicates).',
      stopping: 'Stop after three series if no condition exceeds 10%.',
      plannedEnd: '2026-08', amendments: [], reportId: 'NR-2026-0007', reviewRequested: false
    },
    {
      id: 'NR-P-2026-0002', status: 'ipa', createdAt: '2026-08-14T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z', ipaAt: '2026-09-02T10:00:00Z',
      title: 'Mechanochemical Suzuki–Miyaura coupling of electron-rich aryl chlorides: additive and milling-frequency screen',
      subfield: 'Organic synthesis', reactionClass: 'Cross-coupling', demo: true,
      authors: [{ name: 'Aino Virtanen', affiliation: inst('Department of Chemistry'), orcid: O('000000010000900'), role: '' }],
      submitter: { name: 'Aino Virtanen', orcid: O('000000010000900'), method: 'orcid' },
      question: 'Does ball milling enable Pd-catalysed Suzuki–Miyaura coupling of unactivated, electron-rich aryl chlorides without solvent?',
      hypothesis: 'Mechanical activation and liquid-assisted grinding increase effective concentration and catalyst turnover, which may overcome the slow oxidative addition into electron-rich C–Cl bonds that limits solution-phase protocols.',
      system: '4-Chloroanisole and 4-chlorotoluene + phenylboronic acid; Pd(OAc)₂ with Buchwald-type ligands; K₃PO₄; stainless-steel jars.',
      design: 'Four ligands × three liquid-assisted-grinding additives × two milling frequencies (24 reactions), then optimisation of the best combination over time and loading (24 reactions).',
      controls: 'Positive control: 4-bromoanisole under identical milling conditions; solution-phase reference at 80 °C; no-Pd control.',
      analytics: ['GC-MS', 'NMR'],
      metric: 'Yield of biaryl (%)', threshold: 40,
      successCriterion: 'At least one condition giving ≥ 40% yield of the biaryl from the aryl chloride.',
      stopping: 'Stop after 48 reactions or when two optimisation rounds do not improve the best yield.',
      plannedEnd: '2027-03', amendments: [], reportId: null, reviewRequested: false
    },
    {
      id: 'NR-P-2026-0003', status: 'registered', createdAt: '2026-09-30T10:00:00Z', updatedAt: '2026-09-30T10:00:00Z', ipaAt: null,
      title: 'Organic-dye photocatalysed decarboxylative amination of secondary alkyl carboxylic acids',
      subfield: 'Photochemistry', reactionClass: 'Photoredox / photochemistry', demo: true,
      authors: [{ name: 'Rafael Costa', affiliation: inst('Institute of Technical Chemistry'), orcid: O('000000010001400'), role: '' }],
      submitter: { name: 'Rafael Costa', orcid: O('000000010001400'), method: 'orcid' },
      question: 'Can organic photocatalysts replace iridium complexes in the decarboxylative amination of secondary alkyl carboxylic acids with azodicarboxylates?',
      hypothesis: 'Strongly oxidising acridinium and cyanoarene dyes can oxidise carboxylates to alkyl radicals that are trapped by azodicarboxylates. Reported scope with primary and tertiary acids suggests secondary acids should work if radical lifetime and trapping are balanced.',
      system: 'Cyclohexane-, cyclopentane- and 2-butylcarboxylic acids + DBAD; Mes-Acr⁺, 4CzIPN, 3DPAFIPN; Cs₂CO₃; MeCN/DMF; 455 nm.',
      design: 'Three photocatalysts × three acids × two solvents (18 reactions), then a base and concentration screen with the best catalyst (24 reactions).',
      controls: 'Positive control: 1-adamantanecarboxylic acid (tertiary); dark and no-catalyst negative controls.',
      analytics: ['NMR', 'LC-MS'],
      metric: 'Yield of aminated product (%)', threshold: 30,
      successCriterion: 'At least two of the three secondary acids giving ≥ 30% isolated yield.',
      stopping: 'Stop after 42 reactions.',
      plannedEnd: '2027-06', amendments: [], reportId: null, reviewRequested: true
    }
  ];

  const wanted = [
    {
      id: 'W-0001', title: 'Has anyone made Ni-catalysed cross-electrophile coupling work with tertiary alkyl chlorides?',
      details: 'We are planning to use tertiary chlorides as quaternary-centre precursors. Everything we find in the literature uses bromides or iodides — we would like to know which conditions people have already tried without success.',
      reactionClass: 'Cross-coupling', createdAt: '2026-09-18T10:00:00Z', demo: true,
      by: { name: 'Elias Novak', orcid: O('000000010001500') },
      meToo: Array.from({ length: 14 }, (_, i) => 'demo-a' + i), responses: [{ kind: 'report', id: 'NR-2026-0006', by: 'Sofia Lindqvist', at: '2026-10-03T09:00:00Z' }], status: 'answered'
    },
    {
      id: 'W-0002', title: 'Late-stage Pd-catalysed C–H fluorination of pyridines — which approaches are known dead ends?',
      details: 'Looking for experience with directed and undirected approaches on 2-substituted pyridines, especially any ligand/oxidant combinations that gave only decomposition.',
      reactionClass: 'C–H functionalisation', createdAt: '2026-09-22T10:00:00Z', demo: true,
      by: { name: 'Nadia Hussain', orcid: O('000000010001600') },
      meToo: Array.from({ length: 9 }, (_, i) => 'demo-b' + i), responses: [], status: 'open'
    },
    {
      id: 'W-0003', title: 'Zr-MOFs with flexible or bent linkers: which modulators and temperatures have been tried?',
      details: 'We want to avoid repeating modulator screens for bent dicarboxylates. Any data on loadings, solvents and water content is welcome — even if everything came out amorphous.',
      reactionClass: 'Materials / MOF synthesis', createdAt: '2026-09-25T10:00:00Z', demo: true,
      by: { name: 'Jin-Woo Park', orcid: O('000000010001700') },
      meToo: Array.from({ length: 6 }, (_, i) => 'demo-c' + i), responses: [{ kind: 'report', id: 'NR-2026-0005', by: 'David Okafor', at: '2026-09-26T09:00:00Z' }], status: 'answered'
    },
    {
      id: 'W-0004', title: 'Transfer hydrogenation of hindered ketones with Fe pincer catalysts — any reproducibility problems?',
      details: 'Several groups report high turnover numbers, but our attempts with 2,4,6-trimethylacetophenone gave erratic conversions between batches of the same catalyst.',
      reactionClass: 'Oxidation / reduction', createdAt: '2026-10-01T10:00:00Z', demo: true,
      by: { name: 'Marta Kowalska', orcid: O('000000010001800') },
      meToo: Array.from({ length: 4 }, (_, i) => 'demo-d' + i), responses: [], status: 'open'
    }
  ];

  const notes = [
    {
      id: 'N-0001', reportId: 'NR-2026-0001', type: 'confirm', createdAt: '2026-07-10T09:00:00Z', demo: true,
      by: { name: 'Fatima Al-Sayed', orcid: O('000000010001900'), method: 'orcid' },
      body: 'We independently ran 18 of the ligand/base combinations (n-butylamine + 4-bromoanisole) in our lab and also saw ≤ 2% product. Pd black formed within three hours in every case.', link: ''
    },
    {
      id: 'N-0002', reportId: 'NR-2026-0006', type: 'confirm', createdAt: '2026-10-04T09:00:00Z', demo: true,
      by: { name: 'Kenji Mori', orcid: O('000000010002000'), method: 'orcid' },
      body: 'Same observation with 1-chlorooctane under our conditions (Zn, DMA, 40 °C): hydrodehalogenation above 60%, coupling below 5%.', link: ''
    },
    {
      id: 'N-0003', reportId: 'NR-2026-0006', type: 'confirm', createdAt: '2026-10-05T09:00:00Z', demo: true,
      by: { name: 'Lucía Ortega', orcid: O('000000010002100'), method: 'orcid' },
      body: 'Reproduced the Mn series with the same ligand set. Conversion stalls after about two hours, as described.', link: ''
    },
    {
      id: 'N-0004', reportId: 'NR-2026-0004', type: 'contradict', createdAt: '2026-09-20T09:00:00Z', demo: true,
      by: { name: 'Arjun Mehta', orcid: O('000000010002200'), method: 'orcid' },
      body: 'With ethyl pyruvate in toluene at −40 °C and 10 mol% of a thiourea co-catalyst we observe 41% ee (n = 3). The H-bond donor may be the missing ingredient for the ketoester case.', link: ''
    },
    {
      id: 'N-0005', reportId: 'NR-2026-0002', type: 'question', createdAt: '2026-08-02T09:00:00Z', demo: true,
      by: { name: 'Chiara Romano', orcid: O('000000010002300'), method: 'orcid' },
      body: 'Did you check the purity of TIPS-EBX by NMR before each run? Some of our batches contained roughly 5% hydrolysis product, which might matter for the reagent-loading series.', link: ''
    }
  ];

  const L = (o) => Object.assign({ createdAt: '2026-10-01T09:00:00Z', stage: 'New', notes: '', consent: true, demo: true }, o);
  const leads = [
    L({ id: 'L-0001', type: 'pilot', name: 'Example Lead A (PhD student)', email: 'a@example.invalid', institution: 'Demo University', role: 'PhD student', field: 'Catalysis', message: 'Three years of Pd-catalysed C–H functionalisation attempts, hundreds of runs in an ELN.', experiments: '200–1000', approval: 'I will ask my PI', stage: 'Data received', createdAt: '2026-09-15T09:00:00Z' }),
    L({ id: 'L-0002', type: 'pilot', name: 'Example Lead B (postdoc)', email: 'b@example.invalid', institution: 'Demo University', role: 'Postdoc', field: 'Photochemistry', message: 'Project on photoredox couplings with unexpected catalyst decomposition.', experiments: '50–200', approval: 'Yes', stage: 'Permission signed', createdAt: '2026-09-17T09:00:00Z' }),
    L({ id: 'L-0003', type: 'pilot', name: 'Example Lead C (PI)', email: 'c@example.invalid', institution: 'Demo Institute', role: 'Group leader (PI)', field: 'Materials / MOFs', message: 'Two completed MOF projects that never gave a crystalline phase.', experiments: '200–1000', approval: 'I am the PI', stage: 'Contacted', createdAt: '2026-09-28T09:00:00Z' }),
    L({ id: 'L-0004', type: 'pilot', name: 'Example Lead D (PhD student)', email: 'd@example.invalid', institution: 'Demo University', role: 'PhD student', field: 'Organic synthesis', message: 'Asymmetric organocatalysis that did not give ee.', experiments: '50–200', approval: 'I will ask my PI', stage: 'New', createdAt: '2026-10-03T09:00:00Z' }),
    L({ id: 'L-0005', type: 'reviewer', name: 'Example Reviewer E', email: 'e@example.invalid', institution: 'Demo University', role: 'Both', field: 'Catalysis', message: 'Happy to review catalysis and organometallic reports (about 6 per year).', stage: 'Accepted', createdAt: '2026-09-20T09:00:00Z' }),
    L({ id: 'L-0006', type: 'reviewer', name: 'Example Reviewer F', email: 'f@example.invalid', institution: 'Demo Institute', role: 'Editor', field: 'Photochemistry', message: 'Interested in a founding editor role for photochemistry/electrochemistry.', stage: 'New', createdAt: '2026-10-02T09:00:00Z' }),
    L({ id: 'L-0007', type: 'org', name: 'Example Contact G', email: 'g@example.invalid', institution: 'Demo Pharma (fictional)', role: 'Pharma / chemical industry', field: '', message: 'Would like to see how negative reaction data could feed internal reaction-prediction models.', intent: 'pilot', budget: '15–50k', stage: 'Interested', createdAt: '2026-09-24T09:00:00Z' }),
    L({ id: 'L-0008', type: 'org', name: 'Example Contact H', email: 'h@example.invalid', institution: 'Demo University Library (fictional)', role: 'University library / research office', field: '', message: 'Considering an institutional agreement to cover publication fees of our chemists.', intent: 'info', budget: '5–15k', stage: 'Contacted', createdAt: '2026-10-04T09:00:00Z' }),
    L({ id: 'L-0009', type: 'data', name: 'Example Contact I', email: 'i@example.invalid', institution: 'Demo AI Chemistry (fictional)', role: 'AI / software company', useCase: 'Model training', volume: 'Bulk snapshot plus updates', message: 'We train a reaction-outcome model and need negative examples with consistent metadata.', stage: 'Use case clear', createdAt: '2026-10-03T09:00:00Z' }),
    L({ id: 'L-0010', type: 'enterprise', name: 'Example Contact J', email: 'j@example.invalid', institution: 'Demo Pharma R&D (fictional)', role: 'Pharma / chemical industry', teamSize: '50–200', needs: 'Confidential workspace; SSO later', message: 'Failed late-stage reactions disappear when people leave. We would like a searchable internal archive.', stage: 'Demo', createdAt: '2026-10-04T09:00:00Z' })
  ];

  // ---- Enterprise demo: a FICTIONAL pharma R&D organisation with confidential entries (visible only to its members) ----
  const X = (list, seed) => experimentsFor(list, seed).map(e => ({ ...e, id: 'X' + e.id.slice(1) }));
  const DANA = { email: 'member@demo-pharma.invalid', name: 'Dana Demo' }, LUKAS = { email: 'lukas@demo-pharma.invalid', name: 'Lukas Beispiel' }, PRIYA = { email: 'priya@demo-pharma.invalid', name: 'Priya Example' };
  const orgs = [{
    id: 'O-0001', name: 'Demo Pharma R&D (fictional)', createdAt: '2026-09-15T09:00:00Z', demo: true,
    members: [{ ...DANA, role: 'admin', addedAt: '2026-09-15T09:30:00Z' }, { ...LUKAS, role: 'member', addedAt: '2026-09-16T08:00:00Z' }, { ...PRIYA, role: 'member', addedAt: '2026-09-16T08:05:00Z' }],
    invites: [{ email: 'new.hire@demo-pharma.invalid', role: 'member', invitedAt: '2026-10-02T09:00:00Z' }]
  }];
  const E = (n, who, at, o, series, seed) => Object.assign({
    id: 'E-' + String(n).padStart(4, '0'), orgId: 'O-0001', authorName: who.name, authorKey: who.email, project: '', recommendation: '', tags: [], links: [], metric: 'Yield (%)', threshold: 30,
    series: series || [], experiments: series ? X(series, seed) : [], archived: false, releasedReportId: null, createdAt: at, updatedAt: at, demo: true
  }, o);
  const entries = [
    E(1, LUKAS, '2026-09-17T10:00:00Z', {
      title: 'Buchwald–Hartwig amination of a 2-chloropyrimidine with a hindered secondary amine: hydrodehalogenation only', project: 'KRAS-12 series', subfield: 'Catalysis', reactionClass: 'Amination / C–N coupling',
      goal: 'Install the 3,3-dimethylpiperidine on the pyrimidine core (step 6 of the route).',
      approach: 'Pd2(dba)3 or Pd(OAc)2 with BrettPhos, RuPhos, XPhos or tBuXPhos; NaOtBu, Cs2CO3 or K3PO4; toluene or dioxane; 80–110 °C; 26 runs in total.',
      outcome: 'Product below 3% in all runs. The main product was the hydrodehalogenated pyrimidine (up to 60%); the amine was recovered. The morpholine control gave 88%.',
      failureCategory: 'unexpected-product', learnings: 'β-Hydride elimination from the hindered amine competes under every ligand/base pair we tried. SNAr at high temperature was not tested here.',
      recommendation: 'Do not repeat with Pd. Try SNAr in NMP at 140 °C or a pre-formed lithium amide at low temperature.', tags: ['buchwald-hartwig', 'pyrimidine', 'hydrodehalogenation']
    }, [S('Ligand screen', 16, 'Pd2(dba)3 / L1–L4', 'toluene', '80–110', '24', 3, 'best 3%, median 0.4%'), S('Base and solvent screen', 8, 'Pd(OAc)2 / RuPhos', 'dioxane / toluene', '100', '24', 2, 'best 2%'), S('Positive control (morpholine)', 2, 'Pd2(dba)3 / RuPhos', 'toluene', '100', '24', 88, '88%', true)], 9101),
    E(2, PRIYA, '2026-09-22T14:20:00Z', {
      title: 'Late-stage C–H fluorination of the lead scaffold with Selectfluor: decomposition of the aminopyridine ring', project: 'KRAS-12 series', subfield: 'Organic synthesis', reactionClass: 'C–H functionalisation',
      goal: 'Introduce fluorine next to the ring nitrogen to block a metabolic soft spot.',
      approach: 'Selectfluor in MeCN at rt to 60 °C; N-fluoropyridinium salts; Ag(I)-mediated conditions; 14 runs on 20 mg scale.',
      outcome: 'Complete decomposition of the starting material within 2 h with Selectfluor; the Ag-mediated runs gave traces of an N-oxide, no fluorinated product.',
      failureCategory: 'decomposition', learnings: 'The electron-rich aminopyridine is oxidised faster than it is fluorinated. Protecting the exocyclic amine (not tried) may change this.',
      recommendation: 'Introduce the fluorine earlier in the route, before the aminopyridine is formed.', tags: ['fluorination', 'late-stage', 'selectfluor']
    }, [S('Selectfluor', 6, 'Selectfluor', 'MeCN', '25–60', '2–12', 0, 'decomposition'), S('N-fluoropyridinium salts', 4, 'NFPy', 'MeCN', '25', '12', 0, 'no product'), S('Ag-mediated', 4, 'AgNO3 / Selectfluor', 'MeCN / water', '40', '6', 4, 'N-oxide traces')], 9102),
    E(3, DANA, '2026-09-25T09:40:00Z', {
      title: 'TFA deprotection of the Boc-protected spirocyclic amine: ring-opening to the linear amino alcohol', project: 'CNS-7', subfield: 'Organic synthesis', reactionClass: 'Other',
      goal: 'Remove the Boc group to give the free spirocyclic amine for the final amide coupling.',
      approach: 'TFA/DCM 1:4 at 0 °C to rt; HCl in dioxane; ZnBr2 in DCM; TMSOTf/2,6-lutidine; 8 runs on 100 mg scale.',
      outcome: 'Acidic conditions opened the oxetane-like spiro ring to the linear amino alcohol (> 70%). Only the ZnBr2 conditions gave the spirocyclic amine, in 22% with incomplete conversion.',
      failureCategory: 'decomposition', learnings: 'The spiro ether is acid-labile. Lewis-acid or thermal Boc removal avoids protonation of the ether oxygen.',
      recommendation: 'Switch to a Cbz protecting group on this intermediate.', tags: ['boc', 'deprotection', 'spirocycle']
    }, [S('Brønsted acids', 5, 'TFA / HCl', 'DCM / dioxane', '0–25', '1–4', 0, 'ring-opening'), S('Lewis acids', 3, 'ZnBr2 / TMSOTf', 'DCM', '25', '12', 22, 'best 22%')], 9103),
    E(4, LUKAS, '2026-09-29T11:10:00Z', {
      title: 'Photoredox decarboxylative alkylation of a heteroaryl chloride: no turnover under blue light', project: 'CNS-7', subfield: 'Photochemistry', reactionClass: 'Photoredox / photochemistry',
      goal: 'Couple a tertiary carboxylic acid to the 2-chloropyridine core in one step.',
      approach: '[Ir(dF(CF3)ppy)2(dtbbpy)]PF6 or 4CzIPN with NiCl2·glyme / dtbbpy; Cs2CO3; DMA or DMF; blue LEDs (455 nm), 24 h; 20 runs.',
      outcome: 'No cross-coupled product (< 2%); the carboxylic acid was converted to the protodecarboxylated alkane, the chloride was recovered unchanged.',
      failureCategory: 'no-reactivity', learnings: 'Oxidative addition of Ni(0) into the electron-poor 2-chloropyridine appears to be slower than radical quenching. A bromide or iodide analogue may behave differently.',
      recommendation: 'Use the 2-bromo analogue; chloride is not worth another screen.', tags: ['photoredox', 'nickel', 'decarboxylative']
    }, [S('Ir photocatalyst', 10, '[Ir] / NiCl2·glyme / dtbbpy', 'DMA', '25', '24', 2, 'best 2%'), S('Organic dye (4CzIPN)', 8, '4CzIPN / NiCl2·glyme', 'DMF', '25', '24', 1, 'best 1%'), S('Positive control (aryl bromide)', 2, '[Ir] / NiCl2·glyme / dtbbpy', 'DMA', '25', '24', 76, '76%', true)], 9104),
    E(5, PRIYA, '2026-10-01T13:00:00Z', {
      title: 'CAL-B kinetic resolution of the racemic secondary alcohol: ee below 20% in every solvent', project: 'CNS-7', subfield: 'Chemical biology', reactionClass: 'Biocatalysis', metric: 'Enantiomeric excess (% ee)', threshold: 90,
      goal: 'Obtain the (S)-alcohol in ≥ 90% ee by lipase-catalysed acetylation.',
      approach: 'Novozym 435 (CAL-B), vinyl acetate or isopropenyl acetate; MTBE, toluene, 2-MeTHF, MeCN; 25–45 °C; 12 runs.',
      outcome: 'Conversions of 30–48% but ee never above 19%. The enzyme barely distinguishes the two enantiomers.',
      failureCategory: 'low-yield', learnings: 'The quaternary centre next to the carbinol is too bulky for the CAL-B pocket. Other lipases or a ketoreductase route are more promising.',
      recommendation: 'Screen ketoreductases instead of lipases.', tags: ['biocatalysis', 'lipase', 'kinetic resolution']
    }, [S('Solvent screen', 8, 'Novozym 435', 'MTBE / toluene / 2-MeTHF / MeCN', '25–45', '24', 19, 'best 19% ee'), S('Acyl donor screen', 4, 'Novozym 435', 'MTBE', '30', '24', 14, 'best 14% ee')], 9105),
    E(6, DANA, '2026-10-02T15:30:00Z', {
      title: 'Suzuki coupling scale-up from 5 g to 200 g: palladium black and stalled conversion at 60%', project: 'KRAS-12 series', subfield: 'Catalysis', reactionClass: 'Cross-coupling',
      goal: 'Prepare 150 g of the biaryl intermediate for the tox batch.',
      approach: 'Pd(dppf)Cl2 (1 mol%), K2CO3, dioxane/water 4:1, 85 °C; stepwise scale-up 5 g, 20 g, 50 g, 200 g in the 2 L reactor.',
      outcome: '5 g and 20 g gave 92% and 90%. At 50 g conversion stalled at 75%, at 200 g at 60% with visible palladium black; the product was isolated in 51% after a second catalyst charge.',
      failureCategory: 'scale-up', learnings: 'Slower heating and less efficient degassing in the 2 L reactor deactivate the catalyst before the boronic ester is consumed.',
      recommendation: 'Sparge for 30 min, add the catalyst at 60 °C as a degassed solution, and consider the XPhos Pd G3 pre-catalyst.', tags: ['suzuki', 'scale-up', 'palladium black']
    }, [S('Scale-up series', 4, 'Pd(dppf)Cl2', 'dioxane / water', '85', '16', 92, '92% → 51%')], 9106),
    E(7, LUKAS, '2026-10-03T08:45:00Z', {
      title: 'Ni-catalysed cross-electrophile coupling with a primary alkyl bromide: homocoupling dominates', project: 'CNS-7', subfield: 'Catalysis', reactionClass: 'Cross-coupling', archived: true,
      goal: 'Join the aryl iodide and a primary alkyl bromide without preparing an organometallic reagent.',
      approach: 'NiBr2·diglyme / bipyridine ligands, Zn or Mn reductant, DMA, rt to 60 °C; 18 runs.',
      outcome: 'Aryl–aryl homocoupling was the main product (30–60%); the cross-coupled product reached 9% at best.',
      failureCategory: 'unexpected-product', learnings: 'Aryl iodide reduction and homocoupling outcompete oxidative addition of the alkyl bromide with all ligands tried. Superseded by the photoredox route (see E-0004), which also failed.',
      recommendation: 'Archived: a stepwise Negishi coupling is the practical route.', tags: ['nickel', 'cross-electrophile', 'homocoupling']
    }, [S('Ligand screen', 12, 'NiBr2·diglyme / bpy-type', 'DMA', '25–60', '16', 9, 'best 9%'), S('Reductant screen', 6, 'NiBr2·diglyme / dtbbpy', 'DMA', '25', '16', 6, 'best 6%')], 9107),
    E(8, PRIYA, '2026-10-05T10:15:00Z', {
      title: 'HATU amide coupling with an electron-poor aniline: guanidinylation instead of amide formation', project: 'KRAS-12 series', subfield: 'Organic synthesis', reactionClass: 'Other',
      goal: 'Couple the carboxylic acid fragment to the 2,6-difluoro-4-nitroaniline in the last step.',
      approach: 'HATU, HBTU, T3P, EDC/HOBt, acid chloride; DIPEA or pyridine; DMF, DCM or EtOAc; rt to 60 °C; 15 runs.',
      outcome: 'HATU/HBTU gave the tetramethylguanidinium adduct of the aniline (up to 80%); T3P and EDC gave < 5% amide; the acid chloride route gave 35% with 20% diacylation.',
      failureCategory: 'unexpected-product', learnings: 'Slow acylation of the very poor nucleophile lets the aniline attack the uronium reagent. The acid chloride with a hindered base is the only workable option.',
      recommendation: 'Use the acid chloride with 2,6-lutidine at 0 °C, and a slight excess of the acid.', tags: ['amide coupling', 'hatu', 'guanidinylation']
    }, [S('Coupling reagents', 11, 'HATU / HBTU / T3P / EDC', 'DMF / DCM', '25–60', '16', 4, 'best 4% amide'), S('Acid chloride', 4, 'RCOCl / base', 'DCM / EtOAc', '0–25', '4', 35, 'best 35%')], 9108)
  ];
  const A = (n, at, who, action, target, detail) => ({ id: 'A-' + String(n).padStart(5, '0'), orgId: 'O-0001', at, actorName: who.name, action, target, detail, demo: true });
  const audit = [
    A(1, '2026-09-15T09:30:00Z', { name: 'Demo Staff' }, 'member.invite', 'member@demo-pharma.invalid', 'admin'),
    A(2, '2026-09-15T10:05:00Z', DANA, 'member.join', 'member@demo-pharma.invalid', 'admin'),
    A(3, '2026-09-15T10:20:00Z', DANA, 'member.add', 'lukas@demo-pharma.invalid', 'member'),
    A(4, '2026-09-15T10:21:00Z', DANA, 'member.add', 'priya@demo-pharma.invalid', 'member'),
    ...entries.map((e, i) => A(5 + i, e.createdAt, { name: e.authorName }, 'entry.create', e.id, e.title)),
    A(13, '2026-10-04T09:00:00Z', LUKAS, 'entry.archive', 'E-0007', entries[6].title),
    A(14, '2026-10-02T09:00:00Z', DANA, 'member.invite', 'new.hire@demo-pharma.invalid', 'member')
  ].sort((a, b) => a.at.localeCompare(b.at)).map((a, i) => ({ ...a, id: 'A-' + String(i + 1).padStart(5, '0') }));
  window.NR_SEED = { reports, protocols, wanted, notes, leads, orgs, entries, audit };
})();
