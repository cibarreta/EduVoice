
async function createNotification(executor, {
    userId,
    feedbackId = null,
    eventType,
    title,
    message
}) {
    // Generate a notification ID using the sequence table
    const [sequenceResult] = await executor.execute(
        "INSERT INTO notification_id_sequence () VALUES ()"
    );

    const notificationId = sequenceResult.insertId;

    if (!notificationId) {
        throw new Error("Failed to generate notification ID.");
    }

    // Insert the notification using the generated ID
    await executor.execute(
        `INSERT INTO notifications
            (id, user_id, feedback_id, event_type, title, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [notificationId, userId, feedbackId, eventType, title, message]
    );

    return notificationId;
}

async function notifyActiveAdmins(executor, notification) {
    const [admins] = await executor.execute(
        "SELECT id FROM users WHERE role = 'admin' AND is_active = 1"
    );

    for (const admin of admins) {
        await createNotification(executor, {
            ...notification,
            userId: admin.id
        });
    }
}

async function notifyDepartmentStaff(executor, departmentId, notification) {
    const [staffMembers] = await executor.execute(
        "SELECT id FROM users WHERE role = 'staff' AND is_active = 1 AND department_id = ?",
        [departmentId]
    );

    for (const staff of staffMembers) {
        await createNotification(executor, {
            ...notification,
            userId: staff.id
        });
    }
}

module.exports = {
    createNotification,
    notifyActiveAdmins,
    notifyDepartmentStaff
};
