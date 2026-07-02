// REQ-011: every reference kind from a trigger body; each edge originates from the
// trigger container node T. System.debug is the benign-unresolved external (§2 invariant).
trigger T on Account (before insert) {
    AccountHandler.handle();
    ACCOUNTHANDLER.notify();
    AccountHandler h = new AccountHandler();
    h.process();
    h.ilog(9);
    String tg = h.tag();
    ACCOUNTHANDLER cv = new ACCOUNTHANDLER();
    cv.wake();
    String n = h.name;
    String nm = h.next.name;
    Integer m = AccountHandler.MAX_SIZE;
    Level v = Level.HIGH;
    Kit.Part p = new Kit.Part();
    p.snap();
    AccountHandler.log(7);
    AccountHandler.pick('x');
    AccountHandler d;
    Integer sz = d.size;
    List<Account> accs = Trigger.new;
    System.debug(n);
}
