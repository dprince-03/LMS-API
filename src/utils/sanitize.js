// Escape MySQL LIKE wildcards (`%`, `_`) and the escape character itself
// (`\`) in user-supplied search input, so a search string can't be used to
// force an unintentionally broad/expensive scan (e.g. searching for "%").
// MySQL's default LIKE escape character is backslash, so no ESCAPE clause
// is needed on the query side.
const escapeLikeWildcards = (value) => {
	if (typeof value !== "string") return value;
	return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
};

const buildLikeParam = (value) => `%${escapeLikeWildcards(value)}%`;

module.exports = { escapeLikeWildcards, buildLikeParam };
