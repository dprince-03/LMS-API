const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { jwtConfig } = require("../config/auth.config");

// Standard access token — used for every authenticated API request.
const generateAccessToken = (userId, email, role) => {
	return jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET, {
		expiresIn: jwtConfig.expiresIn,
		algorithm: jwtConfig.algorithm,
		issuer: jwtConfig.issuer,
		audience: jwtConfig.audience,
	});
};

// Short-lived, single-purpose token for the password reset flow. Carries a
// `purpose` claim so it can never be accepted as a regular access token (see
// verifyToken in auth.middlewares.js), and vice versa. Includes a random
// `jti` so two tokens minted for the same user within the same second (the
// payload+iat would otherwise collide) are never byte-identical — that
// matters because identical tokens would share a blacklist entry, letting
// one request's "already used" state falsely apply to another's.
const generateResetToken = (userId, email) => {
	return jwt.sign(
		{
			id: userId,
			email,
			purpose: "password_reset",
			jti: crypto.randomBytes(16).toString("hex"),
		},
		process.env.JWT_SECRET,
		{
			expiresIn: "1h",
			algorithm: jwtConfig.algorithm,
			issuer: jwtConfig.issuer,
			audience: jwtConfig.audience,
		}
	);
};

// Verifies signature, algorithm, issuer, and audience for any token issued
// by this app (access or reset). Does not check the `purpose` claim —
// callers decide what's acceptable for their context.
const verifyAppToken = (token) => {
	return jwt.verify(token, process.env.JWT_SECRET, {
		algorithms: [jwtConfig.algorithm],
		issuer: jwtConfig.issuer,
		audience: jwtConfig.audience,
	});
};

module.exports = { generateAccessToken, generateResetToken, verifyAppToken };
