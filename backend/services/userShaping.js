function shapeUserForResponse(user, { isOwner }) {
    return {
        id: user.id,
        username: user.username,
        bio: user.bio || "",
        publicEmail: Boolean(user.public_email),
        email: isOwner || Boolean(user.public_email) ? user.email : null,
        qscore: user.qscore
    };
}

module.exports = { shapeUserForResponse };
