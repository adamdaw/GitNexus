// REQ-011: every reference kind from a trigger body; each edge originates from the
// trigger container node T. System.debug is the benign-unresolved external (§2 invariant).
trigger T on Account (before insert) {
    AccountHandler.handle();
    ACCOUNTHANDLER.notify();
    AccountHandler h = new AccountHandler();
    h.process();
    String n = h.name;
    Integer m = AccountHandler.MAX_SIZE;
    Level v = Level.HIGH;
    AccountHandler.log(7);
    AccountHandler.pick('x');
    AccountHandler d;
    Integer sz = d.size;
    List<Account> accs = Trigger.new;
    System.debug(n);
}
