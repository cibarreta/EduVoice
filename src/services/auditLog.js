async function recordAudit(executor, {
    actorUserId,
    action,
    entityType,
    entityId = null,
    details = null
}) {
    await executor.execute(
        `INSERT INTO audit_logs
            (actor_user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
            actorUserId || null,
            action,
            entityType,
            entityId,
            details === null ? null : JSON.stringify(details)
        ]
    );
}

module.exports = { recordAudit };
