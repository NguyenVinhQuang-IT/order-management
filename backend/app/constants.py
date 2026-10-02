MAX_ORDERS_PER_ENTRY = 200;
ORDER_PAGE_SIZE = 50
MAX_SECONDS = 99999
PD_PREFIX = "PD|"
TOKEN_MAX_AGE = 60 * 60 * 24 * 7

PD_PROCESS_SLUGS = frozenset({"lam-don", "kiem-don"})

PROCESSES = (
    (1, "xep-ban-nhan-don", "Xếp bản nhận đơn"),
    (2, "kiem-don-voi-mau", "Kiểm đơn với mẫu"),
    (3, "phan-hinh-the-mau-tem-chuyen-in", "Phân hình thể màu, phân số lượng tem chuyển in"),
    (4, "luu-thong-so-san-pham", "Lưu thông số sản phẩm"),
    (5, "sap-xep-seka", "Sắp xếp seka"),
    (6, "lam-don", "Làm đơn"),
    (7, "kiem-don", "Kiểm đơn"),
    (8, "gui-layout-don-san-xuat", "Gửi layout đơn sản xuất"),
    (9, "lam-file-ban-nhua", "Làm file bản nhựa"),
    (10, "lam-layout", "Làm layout"),
    (11, "lam-don-mau", "Làm đơn mẫu"),
    (12, "bu-don", "Bù đơn"),
    (13, "ve-cat-hinh-giay", "Vẽ, cắt hình giày"),
    (14, "luu-macro", "Lưu macro"),
    (15, "upload-hinh-giay", "Upload hình giày lên hệ thống"),
    (16, "viet-code", "Viết code"),
    (17, "luu-size-doi-chieu", "Lưu size đối chiếu"),
    (18, "luu-btw", "Lưu BTW"),
    (19, "don-loi", "Đơn lỗi"),
)

PROCESS_BY_SLUG = {slug: (pid, name) for pid, slug, name in PROCESSES}
PROCESS_BY_ID = {pid: (slug, name) for pid, slug, name in PROCESSES}
PROCESS_BY_NAME = {name: (pid, slug) for pid, slug, name in PROCESSES}

ROLES = frozenset({"employee", "manager"})

SEED_EMPLOYEES = (
    (1, "Quang", "employee", "123456"),
    (2, "Lan", "employee", "123456"),
    (169, "Trúc", "manager", "123456"),
)
