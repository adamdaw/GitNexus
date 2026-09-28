public with sharing class AuditLogger {
    @InvocableMethod(label='Log It')
    public static void log(List<String> messages) {
        System.debug(messages);
    }
}
