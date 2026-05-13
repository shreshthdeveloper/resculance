const express = require('express');
const AuthController = require('../controllers/authController');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  validate
} = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const uploadProfile = require('../middleware/multerProfile');

const router = express.Router();

router.post('/register', registerValidation, validate, AuthController.register);
router.post('/login', loginValidation, validate, AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/forgot-password', AuthController.forgotPassword);

router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/profile/image', authenticate, uploadProfile.single('avatar'), AuthController.uploadProfileImage);
router.put('/change-password', authenticate, changePasswordValidation, validate, AuthController.changePassword);

module.exports = router;
