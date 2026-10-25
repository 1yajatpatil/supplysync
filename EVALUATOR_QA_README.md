# SupplySync — Evaluator Q&A Prep

**Triwizathon 2026 · Round 2 Development Phase · Problem Statement 2**

This document collects the questions an evaluator is likely to ask during the Round 2 review, mapped to the three scored criteria, with answers grounded in a direct read of the codebase (optimizer, validator, baseline heuristic, demand forecasting, auth, CSV onboarding, benchmarks).

**Quick facts to keep handy:**
- Two-phase lexicographic MILP (Google OR-Tools, SCIP → CBC fallback): Phase 1 minimizes economic cost, Phase 2 minimizes shelf-life consumption without raising that cost.
- 10 invariants enforced on every plan by `engine/validator.py`.
- 13 automated pytest suites + 15 adversarial benchmark scenarios (`engine/benchmarks.py`).
- A brute-force `exhaustive_oracle.py` independently verifies MILP optimality on small instances.
- 6-file CSV onboarding wizard lets any company upload its own network, not just the bundled demo/M5 data.
- Real Walmart M5 Kaggle dataset used for forecasting, explicitly and visibly separated from a "Configured Logistics" scenario since M5 has no real distribution data.

---

## Table of Contents
- [A. Development Progress & Implementation (10 marks)](#a-development-progress--implementation-10-marks)
- [B. Technical Quality & Problem Solving (10 marks)](#b-technical-quality--problem-solving-10-marks)
- [C. Project Demonstration & Team Understanding (10 marks)](#c-project-demonstration--team-understanding-10-marks)
- [If They're Trying to Trip You Up](#if-theyre-trying-to-trip-you-up)
- [Roadmap to Final Submission](#roadmap-to-final-submission)

---

## A. Development Progress & Implementation (10 marks)

### 1. What have you built since the last evaluation?
A complete, wired, three-tier stack: a React/Vite client, a Node/Express API gateway with real authentication, and a Python/FastAPI optimization engine on Google OR-Tools. New since the last checkpoint: persisted user accounts and run history (SQLite), a six-file CSV onboarding wizard so any company — not just our demo dataset — can upload its own network, integration of the real Walmart M5 Kaggle dataset alongside our synthetic FMCG demo, a two-phase lexicographic MILP replacing an earlier single-objective formulation, a 10-invariant plan validator, and a 15-scenario adversarial benchmark suite with a brute-force oracle to independently verify optimality.

### 2. Walk me through the module breakdown — what does each part of the stack actually do?
- **Client** — planning wizard, allocation table, reasoning drawer, KPI cards, demand forecaster, comparison audit view.
- **Server** — thin API gateway: auth, master data, proxies requests to the engine, persists run metadata.
- **Engine** — the real logic: `m5_loader`/`m5_logistics` for real data, `demand.py` for forecasting, `optimizer.py` for the MILP, `baseline.py` for the greedy heuristic, `validator.py` for invariant checks, `comparator.py` for the head-to-head verdict, and `exhaustive_oracle.py` + `benchmarks.py` for correctness proofs.

### 3. What's genuinely finished versus still in progress?
**Finished:** the full pipeline from M5 sales history through forecasting, horizon-scaled demand, MILP optimization, invariant validation, UI, and CSV export; the dual data-source toggle; CSV company onboarding; auth and run persistence; all automated tests passing.

**In progress / roadmap:** multi-echelon warehouse-to-warehouse rebalancing before final dispatch, tiered FTL/LTL freight pricing instead of flat per-unit rates, a geospatial route map, and a gradient-boosted forecaster with promo/holiday features.

### 4. How do you know this is real progress and not just features piling up?
Every change has to clear the invariant validator before a plan is ever shown in the UI, and the pytest suite runs against fixed scenarios — so a regression fails a test, it doesn't just "look fine" in a demo. We also track progress by how many of the 15 adversarial benchmark scenarios (tight capacity, near-expiry pressure, SLA competition, unconstrained baselines) produce correct, provably-matching results — not by lines of code added.

### 5. Show me it running — what should we expect to see?
Pick a data source (real M5 retail data, or upload your own six CSVs) → pick a planning horizon (7/14/30 days) → run Baseline vs. OR-Tools → an allocation table where every shipment line shows its cost and FEFO rationale → a KPI strip (fulfillment %, freight cost, unmet demand, active lanes, solver runtime) → a Comparison Audit tab that quantifies exactly what the optimizer improved → a CSV export of the final dispatch plan.

---

## B. Technical Quality & Problem Solving (10 marks)

### 1. What's the mathematical core of the optimizer?
A Mixed-Integer Linear Program solved with Google OR-Tools (SCIP, falling back to CBC). The decision variable `x[w,d,p,b]` is the integer number of units of product `p` from batch `b` shipped from warehouse `w` to destination `d`; `u[d,p]` is unmet demand. Hard constraints: batch inventory can't be over-shipped, routes can't exceed their unit or weight capacity, and shipped-plus-unmet must exactly equal forecasted demand. A batch is only eligible at all if its remaining shelf life after transit still clears the product's minimum required shelf life on arrival.

### 2. Why MILP instead of a simpler heuristic or a continuous LP?
Products ship in whole units — you can't dispatch 4.37 crates — so a continuous solver like GLOP would produce physically impossible fractional shipments. SCIP/CBC enforce integrality while still finding, or provably bounding, the global optimum, which a greedy rule can't guarantee. We kept the greedy heuristic too, deliberately — not as a fallback, but as the honest baseline we benchmark the optimizer against.

### 3. Explain the two-phase "lexicographic" objective. Why not one weighted score?
Phase 1 minimizes pure economic cost — freight plus a tier-weighted shortage penalty — and finds the true cost-optimal value. Phase 2 re-solves with that exact cost locked in as a hard ceiling, and a secondary objective that minimizes total shelf-life consumed, so among every allocation tied for cheapest, it picks the one that clears near-expiry stock first. We don't fold a FEFO "bonus" directly into the dollar objective, because a subsidy large enough to matter risks pushing some coefficient negative — creating a free-money bug where the solver ships product nobody needs just to collect the bonus. Lexicographic ordering keeps the dashboard's reported savings mathematically honest.

### 4. How do you know the optimizer's output is actually correct, not just "didn't crash"?
Three independent checks:
1. A validator enforces 10 invariants on every single plan — no negative or fractional shipments, no batch or route over capacity, zero expired stock ever allocated, shelf-life-on-arrival honored, and every reported cost/weight/fulfillment figure reconciled exactly against the underlying line items.
2. A brute-force oracle enumerates every feasible integer allocation on small instances and finds the literal global minimum, which we cross-check against the solver's answer.
3. A mutation-audit benchmark deliberately corrupts a valid plan — sneaks in expired stock, over-ships a batch — and confirms the validator actually catches it, so we're testing the checker, not just the solver.

### 5. What happens when demand can't be fully met — does the model just fail?
No — unmet demand is itself a bounded decision variable, so the model is always feasible; the solver can choose to leave demand unmet rather than fail outright, and a shortage penalty (weighted 1.3x harder for Tier-1 retail than standard wholesale) makes it only do that when genuinely necessary. True infeasibility, like a destination with demand but no connecting route under strict-fulfillment mode, is caught explicitly and raised with the solver's status attached.

### 6. The M5 dataset has no logistics data — how did you handle that honestly?
We didn't fabricate it. M5 gives us genuine daily sales history per SKU per store, which is exactly what's needed for the forecasting half of the pipeline — but it's a retail sales log, not a distribution network. So we layer a clearly-labeled "Configured Logistics" scenario on top: warehouse locations, route distances, tariffs, and corridor capacity that we define ourselves, and we never present those as Walmart's real numbers. That separation is visible in the UI, not buried in a footnote.

### 7. How does demand forecasting work, and why trust it?
Two models are backtested per SKU/store: a 7-day moving average baseline, and a linear regression using lag-1, lag-7, and day-of-week features. We use a chronological train/test split — holding out the most recent ~14 days with zero lookahead — and pick whichever model scores lower on WAPE, the standard retail metric because it tolerates FMCG's many zero-sales days without blowing up like a plain percentage error would. The winning model then recursively projects the requested 7/14/30-day horizon, and that forecast flows straight into the optimizer as demand.

### 8. What real engineering problems did you hit, and how did you solve them?
Getting the FEFO subsidy safe in an earlier single-objective version — too generous a near-expiry discount and the effective cost coefficient could turn negative, creating that free-money incentive to ship unnecessarily. We solved it structurally by moving to the two-phase lexicographic formulation instead of hand-tuning a cap. Separately: reconciling route capacity in both units and kilograms at once, since a lane can be fine on crate count but blocked on payload weight for heavier SKUs. And sanitizing arbitrary company-uploaded CSVs — type coercion and referential integrity across six linked files — before any of it reaches the solver.

### 9. What clean-code or architecture decisions are you proud of?
Strict separation of concerns across three processes with a typed contract between them — Pydantic models in the engine, TypeScript interfaces at the gateway. The engine's core functions (baseline, optimizer, validator) are pure over typed inputs with no hidden global state, so each is independently unit-testable against the same fixtures. Auth stores only bcrypt password hashes and SHA-256-hashed session tokens — never a usable credential at rest — and there are zero hardcoded demo credentials in source.

### 10. What security considerations did you address?
Passwords are bcrypt-hashed, session tokens are random 32-byte values with only their hash persisted so a database leak can't be replayed, sessions expire and can be explicitly revoked on logout, and both email format and password strength are validated server-side. The one demo-convenience evaluator account only seeds from an environment variable and is refused outright in production if the password is short or matches a known default.

---

## C. Project Demonstration & Team Understanding (10 marks)

### 1. In one minute, what does SupplySync do and for whom?
It's a decision-support engine for FMCG distribution planners. Feed it your warehouses, batch-level inventory with expiry dates, delivery routes with cost and capacity, and a demand forecast — it computes the mathematically optimal shipment plan, minimizing freight plus stockout cost while strictly enforcing first-expired-first-out rules, and explains in plain language why each shipment was chosen, against what a naive "nearest or cheapest warehouse" heuristic would have done instead.

### 2. Why does this matter — what's the actual business case?
FMCG distributors routinely lose money two ways at once: paying for unnecessary long-haul freight while a nearby regional DC sits on stock that's about to expire and get written off. A jointly-optimized model catches trade-offs a spreadsheet or a human planner misses — for instance, paying a little more freight to clear near-expiry stock ahead of a Tier-1 customer's SLA deadline, instead of taking the cheapest route on paper and letting that stock spoil.

### 3. Justify the stack: why MILP and not reinforcement learning or a pure ML model?
This is a constrained combinatorial allocation problem with hard physical rules — you can't ship expired stock, you can't exceed truck capacity — which is exactly the problem class MILP is built for, and it comes with a certificate of optimality (or a provable gap) that a trained model doesn't give you by default. Machine learning earns its place elsewhere in the pipeline — demand forecasting — where the problem is genuinely statistical rather than combinatorial. Using the right tool for each sub-problem, instead of forcing one model to do everything, is itself a defensible technical decision.

### 4. Who on the team owned what?
**Personalize this before the review:** map your actual teammates to the four natural workstreams — frontend/UX (planning wizard, allocation views), API & auth (Node/Express gateway, SQLite persistence), optimization & math (OR-Tools engine, validator, benchmarks), and data integration (M5 loader, forecasting, CSV onboarding). Naming the real person against the real module reads as understanding; a vague "we all did everything" reads as the opposite.

### 5. What's the single most impressive thing to show a judge in two minutes?
The Comparison Audit view, on a benchmark scenario with tight route capacity and near-expiry stock. It's where the abstract pitch — "constrained optimization beats a greedy heuristic" — becomes a specific, provable number: exact freight savings, exact shortage reduction, exact units of spoilage prevented, computed from two real solver runs rather than asserted.

---

## If They're Trying to Trip You Up

### 1. (Robustness) If I feed your system self-contradictory or malformed data, what actually happens?
Before anything reaches the solver, a dedicated validation pass checks for duplicate IDs, unknown foreign-key references, negative quantities or costs, non-integer fields, and destinations with demand but no connecting route — and it separates true blocking errors from mere warnings. Demand exceeding total inventory, for example, is only a warning, since the solver can legitimately resolve that through shortage penalties rather than crashing.

### 2. (Honesty) Your own comparison tool sometimes says baseline and optimizer are "equal" — isn't that a weak result to show off?
That's the point, not a weakness. The comparator computes real deltas from two real solver runs and will say "equal" rather than invent a difference — including explaining why, e.g. an unconstrained network with cheap supply everywhere makes the greedy heuristic already optimal there. The actual case for the optimizer is made in the constrained benchmark scenarios — tight capacity, expiry pressure, competing SLA tiers — where it provably wins, and showing the honest "equal" case alongside those wins is what makes the comparison credible instead of cherry-picked.

### 3. (Failure modes) What if the SCIP/CBC solver isn't available, or times out?
Solver availability is checked explicitly, and the system raises a clear error rather than silently falling back to a continuous solver that would allow physically impossible fractional shipments. On a time limit, if the solver only reaches FEASIBLE rather than OPTIMAL, we report the MIP gap — the proven distance between the found answer and the solver's best bound — honestly in the metrics instead of quietly claiming optimality we didn't actually reach.

### 4. (Performance) Isn't solving the MILP twice — once per phase — slow?
Phase 2 locks in Phase 1's proven cost as a single extra constraint, so it's a much smaller search over an already-pruned space, not a second cold solve — on our scenario sizes it resolves in the low milliseconds after Phase 1. And if the time budget ran out, Phase 1's result alone is still a fully valid, cost-optimal answer — Phase 2 is a refinement for tie-breaking, not a dependency.

### 5. (Scale) What breaks if the network were 100x larger?
The honest scaling risk is variable count, which grows with warehouses × destinations × products × batches, since each batch is its own solver variable today. The fix is batching inventory into expiry cohorts instead of individual lots, combined with the time-limit and MIP-gap reporting already wired into the solver — so at scale, the system returns a bounded, honestly-labeled near-optimal answer within an SLA instead of hanging indefinitely.

### 6. (Design choice) Why keep a deliberately "worse" greedy baseline in the product at all?
Because "better than what, exactly?" is the first question any evaluator or real customer asks about an optimizer. The baseline is a realistic, defensible heuristic — tier priority, lowest direct tariff, FEFO-sorted — not a strawman built to lose, which is what makes the optimizer's reported savings credible rather than inflated.

### 7. (Limitation) What's the most honest limitation of the system right now?
The optimizer currently solves one aggregate allocation across the whole planning horizon rather than a true day-by-day dispatch schedule with multi-period inventory carryover — it's tactical planning, not yet a full vehicle-routing and scheduling engine. We'd rather name that directly than have a judge discover it, and it's the first item on the extended roadmap.

---

## Roadmap to Final Submission

If asked "what's left" — answer in this order, it reads as prioritized rather than a feature wishlist:

1. **Polish** — A scripted 3-minute walkthrough centered on the Comparison Audit view — that's where the optimizer's case is most visible.
2. **Next** — Multi-echelon warehouse-to-warehouse rebalancing before final dispatch, so stock can reposition between DCs, not only DC → store.
3. **Next** — Tiered FTL/LTL freight pricing in place of flat per-unit rates, closer to how real carriers actually price.
4. **Stretch** — A geospatial route map, and a gradient-boosted forecaster (LightGBM/XGBoost) with promotional and holiday features.

---

*Prepared from a direct read of the SupplySync codebase — architecture, MILP formulation, validator, benchmarks, auth, and CSV onboarding — not from the README alone.*
