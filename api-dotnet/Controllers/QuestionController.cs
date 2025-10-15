using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionController : ControllerBase
{
    private readonly FormService _svc;
    public QuestionController(FormService svc) { _svc = svc; }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] QuestionDto dto, CancellationToken ct)
    {
        var rid = await _svc.CreateQuestionAsync(dto, ct);
        return Ok(new { recordId = rid });
    }
}
