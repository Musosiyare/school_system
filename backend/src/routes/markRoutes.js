const router = require("express").Router();
const { submitMarks, getMarks, getMarksEvidencePdf } = require("../controllers/markController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("teacher", "manager"), submitMarks);
router.get("/", authorize("teacher", "manager"), getMarks);
router.get("/evidence/pdf", authorize("teacher", "manager"), getMarksEvidencePdf);

module.exports = router;
