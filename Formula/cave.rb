class Cave < Formula
  desc "Minimal terminal coding agent + multi-provider LLM toolkit"
  homepage "https://github.com/JuliusBrussee/caveman-cli"
  version "0.65.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/JuliusBrussee/caveman-cli/releases/download/v#{version}/cave-darwin-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/JuliusBrussee/caveman-cli/releases/download/v#{version}/cave-darwin-x64"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/JuliusBrussee/caveman-cli/releases/download/v#{version}/cave-linux-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/JuliusBrussee/caveman-cli/releases/download/v#{version}/cave-linux-x64"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    binary = stable.url.split("/").last
    bin.install binary => "cave"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/cave --version")
  end
end
