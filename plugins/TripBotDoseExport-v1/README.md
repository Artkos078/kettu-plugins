# TripBot Dose Export

Exports TripBot dose entries from the currently open Discord DM into a JSON file that DoseDiary can import directly.

## Use

1. Open your DM with TripBot in Kettu.
2. Open Kettu settings, then **TripBot Dose Export**.
3. Tap **Export for DoseDiary**.
4. In the iOS share sheet, save the JSON file to Files.
5. Open DoseDiary, choose **Import**, tap **Choose File**, and select the JSON file.

The plugin reads the DM through the current signed-in Kettu session. It never asks for, displays, or stores a Discord token. It exports only recognized `You dosed ...` entries; unrelated messages are left out.
