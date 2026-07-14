# Hevy Bulk Exercise Replacer

A simple browser tool to bulk-replace incorrectly logged exercises across your entire Hevy workout history. Vibe-coded and tested, use at your own risk.

## What it does

Say you logged "Iso-lateral Row" but meant to log "Uni-lateral Row" - this tool finds every instance of the wrong exercise across all your workouts and replaces it with the correct one, in bulk, in one go. All your sets, reps, weight, and notes are preserved.

## Requirements

- A **Hevy Pro** subscription (the API requires a Pro account)
- A Hevy API key from [hevy.com/settings?developer](https://hevy.com/settings?developer)

## Setup

1. Open `hevy-fixer.html` in any modern browser (Chrome, Firefox, Edge, Safari). No server needed - it's a plain HTML file.
2. Paste your API key and click **Connect & Load Templates**.

## How to use

1. **Connect** - paste your API key and connect. All your exercise templates load into the browser.
2. **Select the wrong exercise** - search for and click the exercise you logged incorrectly (it will be highlighted yellow).
3. **Select the correct exercise** - search for and click the right exercise to use instead (highlighted green).
4. **Review** - the tool scans all your workouts and shows you exactly which ones will be changed.
5. **Replace All** - click the button to bulk-update every affected workout. Sets, reps, weight, notes, and superset info are all preserved - only the exercise template ID changes.

## How it works

- Fetches all exercise templates from `GET /v1/exercise_templates` (all pages, loaded once)
- Scans all workouts from `GET /v1/workouts` (all pages)
- Updates each affected workout via `PUT /v1/workouts/{id}`
- No data is deleted - only the exercise template ID on matching exercises is swapped

## File structure

```
hevy-fixer.html   - the page (open this in a browser)
style.css         - styles
script.js         - all logic
README.md         - this file
```

## Troubleshooting

**Search finds nothing.** Make sure you've connected with your API key first. The template list is only populated after connecting.

**"Scan failed" or "Replace failed".** Check your API key is valid and you have an active Hevy Pro subscription.

**No workouts found.** The tool searches by exact exercise template ID. If you created a custom exercise with a different name, it has a different ID -- search by the template ID shown in the tool to find the right one.

**Progress is slow.** The tool updates workouts one at a time to avoid overwhelming the API. For large histories (100+ workouts), it may take a minute or two.

## Privacy

- All API calls go directly from your browser to `api.hevyapp.com`
- No data is sent to any other server
- Your API key is stored in browser localStorage and is never transmitted anywhere but Hevy's API