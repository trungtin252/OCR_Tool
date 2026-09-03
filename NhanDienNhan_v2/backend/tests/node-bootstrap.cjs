// tsx asks Windows for the current account name only to choose a temp folder.
// Some restricted/containerized Windows environments return ENOMEM for that
// OS call. A stable numeric test-runner identity avoids that environment-only
// failure and does not affect application code.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

// Contract tests must not leave OCR history on the developer machine.
process.env.OCR_ARCHIVE_ENABLED = "false";
