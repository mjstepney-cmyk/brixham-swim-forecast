# Brixham Swim Forecast - Swimmer Preference Questionnaire

Use this sheet to collect swimmer preferences for shaping the swim-condition score.

For preference questions, use this scale:

| Score | Meaning |
|---:|---|
| 1 | Not important |
| 2 | Slight preference |
| 3 | Matters |
| 4 | Very important |
| 5 | Decisive |

## Swimmer Details

Name or initials:

Usual swimming pattern:

- [ ] Mostly solo
- [ ] With one other person
- [ ] Small group
- [ ] Organised group

Cold-water experience:

- [ ] Beginner
- [ ] Regular open-water swimmer
- [ ] Experienced
- [ ] Winter swimmer

Typical kit:

- [ ] Swimsuit only
- [ ] Wetsuit
- [ ] Tow float
- [ ] Gloves/boots/hat
- [ ] Other:

## Hard Safety Rules

These are potential override rules. They can turn a swim into "no swim" even if other conditions look good.

| Question | Answer |
|---|---|
| If there is an official pollution warning at Breakwater Beach, should this always be no swim? | Yes / No |
| If thunder or lightning is forecast or observed nearby, should this always be no swim? | Yes / No |
| If visibility is poor, foggy, or dark, should this be no swim or caution? | No swim / Caution / Depends |
| If storm overflow activity is reported at this beach, what should happen? | No swim / Caution / Depends |
| If you are swimming alone, should the app become more conservative? | Yes / No |

## Preference Weights

Rate each factor from 1 to 5.

| Factor | 1-5 score | Notes |
|---|---:|---|
| Higher tide |  |  |
| Tide rising rather than falling |  |  |
| Low wave height |  |  |
| Low chop / settled surface |  |  |
| Low wind speed |  |  |
| Low gust strength |  |  |
| Sheltered wind direction |  |  |
| Warmer sea temperature |  |  |
| Warmer air temperature after the swim |  |  |
| Low rain risk |  |  |
| Bright daylight / good visibility |  |  |
| Easy entry and exit |  |  |
| Other swimmers nearby |  |  |
| Forecast confidence / near-term reliability |  |  |

## Threshold Questions

These help turn preferences into practical scoring bands.

| Question | Answer |
|---|---|
| At what wave height does the swim stop being enjoyable? | 0.3 m / 0.5 m / 0.8 m / 1.0 m+ / Unsure |
| At what wave height would you avoid swimming? | 0.5 m / 0.8 m / 1.0 m / 1.5 m+ / Depends |
| At what wind speed does it stop being enjoyable? | 10 km/h / 20 km/h / 30 km/h / 40 km/h+ / Depends |
| At what gust speed would you avoid swimming? | 20 km/h / 30 km/h / 40 km/h / 50 km/h+ / Depends |
| What sea temperature changes your decision? | Below 8 C / 10 C / 12 C / 15 C / Rarely |
| How much does rain affect your decision? | Not much / Heavy rain only / Avoid rain / Mainly water quality |
| Preferred tide state | High tide / Mid tide rising / Any safe tide / Beach dependent |

## Pollution and Water Quality Away From This Beach

At Breakwater Beach, assume an official pollution warning is automatic no swim. For other beaches, ask:

| Question | Answer |
|---|---|
| After recent overflow or heavy rain, how cautious should the app be? | No swim / 24h wait / 48h wait / Depends on tide/wind / Warning only |
| If tide and wind appear to carry pollution away from the swim area, should the app allow a good score? | No / Heavy caution / Caution only / Yes if official data is clear |
| Which water-quality signals should matter most? | Official warning / Rainfall / Overflow / Tide direction / Wind direction / Local knowledge |

## Local Breakwater Beach Knowledge

Free-text answers are useful here.

1. Which wind directions usually make Breakwater Beach unpleasant or choppy?

2. Which wind directions usually feel sheltered?

3. Are there tide states where entry or exit is awkward?

4. Are there tide states where currents feel stronger?

5. After heavy rain, how long would you normally wait before swimming?

6. Are there conditions where the forecast often looks fine but the beach feels poor?

7. What does your ideal swim window look like?

## Final Ranking

Pick the five factors that matter most to you.

1.
2.
3.
4.
5.

## For Model Conversion

When converting answers into the app's personal preference score:

| Questionnaire score | Model multiplier |
|---:|---:|
| 1 | 0.25x |
| 2 | 0.5x |
| 3 | 1.0x |
| 4 | 1.5x |
| 5 | 2.0x |

Suggested model design:

- Beach safety score: conservative, same for everyone, includes hard warnings.
- Personal preference score: adjusted by swimmer weights.
- Final app wording should distinguish "unsafe", "caution", and "safe but not your preferred conditions".
