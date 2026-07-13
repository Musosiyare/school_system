const router = require("express").Router();
const { getPromotionRoster, promoteStudents } = require("../controllers/promotionController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.get("/roster", authorize("manager"), getPromotionRoster);
router.post("/", authorize("manager"), promoteStudents);

module.exports = router;
