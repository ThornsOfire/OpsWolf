# Current-source actions in Changes

The candidate adds a small **E** button to recognized file headers inside the hosted native Changes tab. Its tooltip says **Open file in editor** and includes the relative path. It loads the current file through the same workspace bridge and save/cancel flow as a file opened from the tree. Historical comparison text is never used as an editable file body.

The native **Open in** and **File actions** controls remain present with their original handlers. The current host exposes those labels rather than the earlier “Open file in tab” button. Moving native menu entries or adding an external program chooser still requires verified host support; this candidate does not claim to implement that part of the destination roadmap.

Files need an absolute native `data-review-path` inside the active workspace. Displayed names are not used to guess paths. Outside-workspace paths, missing identity, ambiguous headers, inactive chats and unknown layouts receive no custom action. A deleted or inaccessible current file follows the existing preview error path; the comparison remains available. While an open/save decision is pending, other current-source actions wait.

`NativeDiffHost` qualifies and owns the native view layout. `NativeDiffFiles` owns only its added controls and tooltips, calling the composition's `openFile` and `announce` capabilities. Native file menus, comparison nodes and event owners stay in place. Context changes and disposal remove owned controls; late results cannot post notices to another chat.

Run `node scripts/test-native-diff-files.mjs` for path identity, duplicate names, real pointer clicks, native-menu preservation, cancellation, rejection and stale-context coverage. Run `node scripts/test-native-diff-host.mjs` for integration and native layout regressions. Synthetic native fixtures verify the observed public structure; live interaction and other native versions remain separate verification.
