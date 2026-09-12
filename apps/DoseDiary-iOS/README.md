# Dose Diary for iOS

A private, offline SwiftUI diary for recording substance or medication use. It stores dose history on the device and supports manual entries, TripBot text imports, duplicate review, Face ID/device-passcode locking, and JSON/CSV export.

## Privacy

- No account, server, analytics, advertisements, or network requests.
- Dose history is written inside the app container with iOS complete file protection.
- TripBot import reads only text that you paste or a file that you explicitly choose.
- Do not place real dose history, Discord exports, certificates, or passwords in this repository.

## Build an IPA without owning a Mac

1. Open the repository's **Actions** tab.
2. Select **Build DoseDiary IPA** and choose **Run workflow**. Changes to this app on `main` also start it.
3. Open the completed run and download the **DoseDiary-unsigned-IPA** artifact.
4. Extract the artifact ZIP to obtain `DoseDiary-unsigned.ipa`.
5. Sign the IPA with your own certificate/signing service, then install it.

The workflow uses a GitHub-hosted Mac, generates the Xcode project with XcodeGen, and builds without embedding a signing identity. GitHub never receives your dose history because the app database is created only after installation.

## TripBot import format

The importer recognizes entries such as:

```text
You dosed 80 MG of Lisdexamfetamine Oral
4h 41m 33s ago on 2026-09-11 14:32:39 UTC-06:00
```

It also accepts multiple copied messages at once and skips entries already saved with the same substance, amount, route, and timestamp.

## Safety scope

This app is a recordkeeping tool. It does not recommend doses, judge combinations, or determine whether use is safe.
