"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_rsc_lib_auth_password_ts";
exports.ids = ["_rsc_lib_auth_password_ts"];
exports.modules = {

/***/ "(rsc)/./lib/auth/password.ts":
/*!******************************!*\
  !*** ./lib/auth/password.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   hashPassword: () => (/* binding */ hashPassword),\n/* harmony export */   verifyPassword: () => (/* binding */ verifyPassword)\n/* harmony export */ });\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! bcryptjs */ \"(rsc)/../../node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs/index.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_0__);\n/**\n * Password hashing utilities using bcryptjs.\n * bcryptjs is pure JavaScript (no native bindings) for maximum portability.\n */ \nconst SALT_ROUNDS = 12;\n/**\n * Hash a plaintext password.\n * Never log the input or output.\n */ async function hashPassword(plaintext) {\n    return bcryptjs__WEBPACK_IMPORTED_MODULE_0___default().hash(plaintext, SALT_ROUNDS);\n}\n/**\n * Verify a plaintext password against a stored hash.\n * Uses constant-time comparison to prevent timing attacks.\n */ async function verifyPassword(plaintext, hash) {\n    return bcryptjs__WEBPACK_IMPORTED_MODULE_0___default().compare(plaintext, hash);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC9wYXNzd29yZC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7OztDQUdDLEdBQzZCO0FBRTlCLE1BQU1DLGNBQWM7QUFFcEI7OztDQUdDLEdBQ00sZUFBZUMsYUFBYUMsU0FBaUI7SUFDbEQsT0FBT0gsb0RBQVcsQ0FBQ0csV0FBV0Y7QUFDaEM7QUFFQTs7O0NBR0MsR0FDTSxlQUFlSSxlQUNwQkYsU0FBaUIsRUFDakJDLElBQVk7SUFFWixPQUFPSix1REFBYyxDQUFDRyxXQUFXQztBQUNuQyIsInNvdXJjZXMiOlsiL2hvbWUvcnVubmVyL3dvcmtzcGFjZS9hcnRpZmFjdHMvaXN0YW5idWwtdmlwLXRyYW5zZmVyL2xpYi9hdXRoL3Bhc3N3b3JkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGFzc3dvcmQgaGFzaGluZyB1dGlsaXRpZXMgdXNpbmcgYmNyeXB0anMuXG4gKiBiY3J5cHRqcyBpcyBwdXJlIEphdmFTY3JpcHQgKG5vIG5hdGl2ZSBiaW5kaW5ncykgZm9yIG1heGltdW0gcG9ydGFiaWxpdHkuXG4gKi9cbmltcG9ydCBiY3J5cHQgZnJvbSAnYmNyeXB0anMnO1xuXG5jb25zdCBTQUxUX1JPVU5EUyA9IDEyO1xuXG4vKipcbiAqIEhhc2ggYSBwbGFpbnRleHQgcGFzc3dvcmQuXG4gKiBOZXZlciBsb2cgdGhlIGlucHV0IG9yIG91dHB1dC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhc2hQYXNzd29yZChwbGFpbnRleHQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBiY3J5cHQuaGFzaChwbGFpbnRleHQsIFNBTFRfUk9VTkRTKTtcbn1cblxuLyoqXG4gKiBWZXJpZnkgYSBwbGFpbnRleHQgcGFzc3dvcmQgYWdhaW5zdCBhIHN0b3JlZCBoYXNoLlxuICogVXNlcyBjb25zdGFudC10aW1lIGNvbXBhcmlzb24gdG8gcHJldmVudCB0aW1pbmcgYXR0YWNrcy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeVBhc3N3b3JkKFxuICBwbGFpbnRleHQ6IHN0cmluZyxcbiAgaGFzaDogc3RyaW5nLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHJldHVybiBiY3J5cHQuY29tcGFyZShwbGFpbnRleHQsIGhhc2gpO1xufVxuIl0sIm5hbWVzIjpbImJjcnlwdCIsIlNBTFRfUk9VTkRTIiwiaGFzaFBhc3N3b3JkIiwicGxhaW50ZXh0IiwiaGFzaCIsInZlcmlmeVBhc3N3b3JkIiwiY29tcGFyZSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth/password.ts\n");

/***/ })

};
;