import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.FileWriter;
import java.io.PrintWriter;

// Ghidra "post script": runs after headless import/analysis completes.
// Decompiles every real function in the binary and writes the combined
// C-like pseudocode to the output path passed as a script argument.
public class DecompileAll extends GhidraScript {

    // Safety cap so a huge or obfuscated binary can't run indefinitely
    // inside the sandbox's own execution timeout.
    private static final int MAX_FUNCTIONS = 200;
    private static final int PER_FUNCTION_TIMEOUT_SECONDS = 30;

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args.length > 0 ? args[0] : "/tmp/decompiled_output.txt";

        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);

        StringBuilder output = new StringBuilder();
        FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);

        int count = 0;
        for (Function func : functions) {
            if (monitor.isCancelled()) {
                break;
            }
            if (func.isThunk() || func.isExternal()) {
                continue;
            }
            if (count >= MAX_FUNCTIONS) {
                output.append("// ... truncated after ").append(MAX_FUNCTIONS).append(" functions ...\n");
                break;
            }

            DecompileResults results = decompiler.decompileFunction(func, PER_FUNCTION_TIMEOUT_SECONDS, monitor);
            if (results != null && results.decompileCompleted()) {
                output.append("// ==== Function: ").append(func.getName())
                      .append(" @ ").append(func.getEntryPoint()).append(" ====\n");
                output.append(results.getDecompiledFunction().getC());
                output.append("\n\n");
                count++;
            }
        }

        try (PrintWriter writer = new PrintWriter(new FileWriter(outPath))) {
            writer.print(output.toString());
        }

        decompiler.dispose();
        println("Decompiled " + count + " function(s) to " + outPath);
    }
}
