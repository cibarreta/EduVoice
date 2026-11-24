
async function recordAudit(executor, {
    actorUserId,
    action,
    entityType,
    entityId = null,
    details = null
}) {
    // Generate a unique audit log ID
    const [sequenceResult] = await executor.execute(
        "INSERT INTO audit_log_id_sequence () VALUES ()"
    );

    const auditId = sequenceResult.insertId;

    if (!auditId) {
        throw new Error("Failed to generate audit log ID.");
    }

    // Insert the audit log using the generated ID
    await executor.execute(
        `INSERT INTO audit_logs
            (id, actor_user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            auditId,
            actorUserId || null,
            action,
            entityType,
            entityId,
            details === null ? null : JSON.stringify(details)
        ]
    );

    return auditId;
}

module.exports = { recordAudit };