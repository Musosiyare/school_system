const router = require("express").Router();
const {
  submitMarks,
  getMarks,
  getMarksEvidencePdf,
  downloadMarksTemplate,
  importMarksTemplate,
} = require("../controllers/markController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("teacher", "manager"), submitMarks);
router.get("/", authorize("teacher", "manager"), getMarks);
router.get("/evidence/pdf", authorize("teacher", "manager"), getMarksEvidencePdf);
router.get("/template", authorize("teacher", "manager"), downloadMarksTemplate);
router.post("/import", authorize("teacher", "manager"), upload.single("file"), importMarksTemplate);

module.exports = router;
