# MC Rangers

The website for MC Rangers, a CUHK student hiking club: upcoming hikes with sign-up links, a blog with photos and comments after every hike, and a merch page.

Live site: https://mcrangers.github.io

## How it works

- Plain HTML, CSS and JavaScript hosted on GitHub Pages. No build step.
- All content lives in `data/`: `site.json` (settings and links), `hikes.json`, `posts.json` and `merch.json`.
- `admin.html` edits those files and uploads photos to `images/uploads/` through the GitHub API, using a fine-grained key with Contents: Read and write on this repository.
- Sign-ups and merch orders go to Google Forms.
- Blog comments use Firebase Authentication and Cloud Firestore on the free plan. Only verified CUHK emails (`@link.cuhk.edu.hk` or `@cuhk.edu.hk`) can post. `firestore.rules` enforces this on the server. See [SETUP.md](SETUP.md).

## Related

- [Trail Bingo](https://github.com/mcrangers/hike-bingo), our hike icebreaker game.

## License

MIT
