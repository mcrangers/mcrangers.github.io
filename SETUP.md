# Turning on blog comments (Firebase, free)

1. Go to https://console.firebase.google.com and **Create a project** (any name, e.g. `mcrangers`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Email/Password → Enable** (leave "Email link" off). Save.
3. **Authentication → Settings → Authorized domains → Add domain**: add `mcrangers.github.io` (and `mcrangers.org` once the domain is set up).
4. **Build → Firestore Database → Create database** → choose region `asia-east2 (Hong Kong)` → start in **production mode**.
5. **Firestore → Rules**: paste everything from `firestore.rules`, replace `your-id@link.cuhk.edu.hk` with the moderator CUHK email(s), then **Publish**.
6. **Project settings (gear) → Your apps → Web (</>)** → register an app (no hosting). Copy `apiKey`, `authDomain`, `projectId` and `appId`.
7. Open the website's **Admin → Settings → Comments setup**, paste the four values, add the same moderator emails, and **Save**.

The Firebase web config is not a secret. It is meant to be public; the rules in step 5 are what protect the data.
