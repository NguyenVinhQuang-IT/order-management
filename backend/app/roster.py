from .auth import hash_password
from .db import get_db
from .services import get_system_config, save_system_config

DEFAULT_PASSWORD = "123456"
MANAGER_IDS = frozenset({169})

# (id, name, pbb, pba) — empty string means no code for that column.
EMPLOYEE_ROSTER = (
    (169, "阮氏竹 Nguyễn Thị Trúc", "PBB0018", "PBA0001"),
    (315, "陈氏金线 Trần Thị Kim Tuyến", "PBB0001", ""),
    (1141, "白鸿云 Bạch Hồng Vân", "PBB0008", ""),
    (1326, "阮氏翠微 Nguyễn Thị Thúy Vy", "PBB0010", "PBA0021"),
    (1416, "黃工后 HUỲNH CÔNG HẬU", "PBB0006", ""),
    (1701, "陈梅顺 TRẦN MAI THUẬN", "PBB0002", ""),
    (1964, "邓是红泠 ĐẶNG THỊ HỒNG LINH", "PBB0003", ""),
    (2032, "黎氏红蝶 LÊ THỊ HỒNG ĐIỆP", "PBB0004", "PBA0009"),
    (2730, "黎氏妹 LÊ THỊ MUỘI", "PBB0005", "PBA0008"),
    (3415, "杨翠生 DƯƠNG THÚY SINH", "PBB0007", "PBA0002"),
    (4537, "黄玉可 HUỲNH NGỌC KHA", "PBB0014", "PBA0013"),
    (4567, "黄阮蔷薇 HUỲNH NGUYỄN TƯỜNG VI", "PBB0011", "PBA0003"),
    (4619, "阮氏明书 NGUYỄN THỊ MINH THƯ", "PBB0012", "PBA0005"),
    (4661, "陈氏宝珍 TRẦN THỊ BẢO TRÂN", "", "PBA0004"),
    (4673, "阮玉映 NGUYỄN NGỌC ÁNH", "PBB0009", ""),
    (4683, "阮氏乔微 NGUYỄN THỊ KIỀU VY", "PBB0013", "PBA0006"),
    (4719, "阮请黄赞 NGUYỄN THANH HUỲNH TRÂM", "PBB0020", "PBA0007"),
    (4848, "阮氏燕儿 NGUYỄN THỊ YẾN NHI", "", "PBA0019"),
    (4922, "阮氏翠银 NGUYỄN THỊ THÚY NGÂN", "PBB0023", "PBA0020"),
    (304739, "张氏小 TRƯƠNG THỊ NHÍ", "PBB0022", ""),
    (304743, "胡文荣 HỒ VĂN MỪNG", "PBB0016", "PBA0010"),
    (304772, "阮玉洲 NGUYỄN NGỌC CHÂU", "PBB0021", "PBA0011"),
    (304788, "梨段氏璃冰 LÊ ĐOÀN THỊ LY BĂNG", "PBB0019", "PBA0012"),
    (304822, "陈玉燕微 TRẦN NGỌC YẾN VY", "", "PBA0014"),
    (304827, "杨进发 DƯƠNG TIẾN PHÁT", "PBB0017", "PBA0016"),
    (304830, "陈氏竹嵋 TRẦN THỊ TRÚC MY", "", "PBA0015"),
    (304836, "阮荣光 NGUYỄN VINH QUANG", "PBB0015", "PBA0017"),
    (304839, "阮英书 NGUYỄN ANH THƯ", "PBB0024", "PBA0018"),
)


def apply_employee_roster(db=None):
    db = db or get_db()
    db.executemany(
        """
        INSERT INTO emp (id, name, pbb, pba) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            pbb = excluded.pbb,
            pba = excluded.pba
        """,
        [
            (emp_id, name, pbb or None, pba or None)
            for emp_id, name, pbb, pba in EMPLOYEE_ROSTER
        ],
    )

    payload = dict(get_system_config(db))
    auth = dict(payload.get("auth") if isinstance(payload.get("auth"), dict) else {})
    password_hash = None
    changed = False
    for emp_id, _name, _pbb, _pba in EMPLOYEE_ROSTER:
        key = str(emp_id)
        if isinstance(auth.get(key), dict) and auth[key].get("password_hash"):
            continue
        if password_hash is None:
            password_hash = hash_password(DEFAULT_PASSWORD)
        current = auth.get(key) if isinstance(auth.get(key), dict) else {}
        auth[key] = {
            "role": current.get("role")
            or ("manager" if emp_id in MANAGER_IDS else "employee"),
            "password_hash": password_hash,
        }
        changed = True
    if changed:
        payload["auth"] = auth
        save_system_config(payload, db)
