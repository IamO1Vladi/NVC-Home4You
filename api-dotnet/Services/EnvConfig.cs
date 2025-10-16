namespace Services;

public class EnvConfig
{
    private readonly IConfiguration _cfg;
    public EnvConfig(IConfiguration cfg) { _cfg = cfg; }

    public string Realm => (_cfg["QUICKBASE_REALM"] ?? "").Trim().TrimEnd('/');
    public string Token => _cfg["QUICKBASE_TOKEN"] ?? "";

    // tables + FIDs...
    public string TableHouses => _cfg["QB_TABLE_HOUSES"] ?? "";
    public string TableImages => _cfg["QB_TABLE_IMAGES"] ?? "";
    public string TableOffer => _cfg["QB_TABLE_OFFER"] ?? "";
    public string TableQuestion => _cfg["QB_TABLE_QUESTION"] ?? "";

    public int F_HOUSE_RID => int.Parse(_cfg["FID_HOUSE_RID"] ?? "3");
    public int F_HOUSE_TITLE => int.Parse(_cfg["FID_HOUSE_TITLE"] ?? "6");
    public int F_HOUSE_PRICE => int.Parse(_cfg["FID_HOUSE_PRICE"] ?? "10");
    public int F_HOUSE_DESC => int.Parse(_cfg["FID_HOUSE_DESC"] ?? "7");
    public int? F_HOUSE_TITLE_BG => int.Parse(_cfg["F_HOUSE_TITLE_B"] ?? "13");
    public int? F_HOUSE_DESC_BG => int.Parse(_cfg["F_HOUSE_DESC_BG"] ?? "14");
    public int F_IMG_PARENT => int.Parse(_cfg["FID_IMG_PARENT"] ?? "6");
    public int F_IMG_URL => int.Parse(_cfg["FID_IMG_URL"] ?? "10");
    public int F_IMG_FILE => int.Parse(_cfg["FID_IMG_FILE"] ?? "9");

    public int F_OFFER_NAME => int.Parse(_cfg["FID_OFFER_NAME"] ?? "7");
    public int F_OFFER_EMAIL => int.Parse(_cfg["FID_OFFER_EMAIL"] ?? "6");
    public int F_OFFER_PHONE => int.Parse(_cfg["FID_OFFER_PHONE"] ?? "9");
    public int F_OFFER_MESSAGE => int.Parse(_cfg["FID_OFFER_MESSAGE"] ?? "10");
    public int F_OFFER_MODEL_ID => int.Parse(_cfg["FID_OFFER_MODEL_ID"] ?? "11");

    public int F_Q_NAME => int.Parse(_cfg["FID_Q_NAME"] ?? "6");
    public int F_Q_EMAIL => int.Parse(_cfg["FID_Q_EMAIL"] ?? "7");
    public int F_Q_MESSAGE => int.Parse(_cfg["FID_Q_MESSAGE"] ?? "8");
}
