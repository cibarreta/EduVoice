async function createNotification(executor, {
    userId,
    feedbackId = null,
    eventType,
    title,
    message
}) {
    await executor.execute(
        `INSERT INTO notifications
            (user_id, feedback_id, event_type, title, message)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, feedbackId, eventType, title, message]
    );
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
